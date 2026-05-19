/* =========================================================================
 * /api/account/artwork — business-only
 *
 * Manage the caller's reusable artwork library. Files live in the
 * Supabase Storage bucket named in ARTWORK_BUCKET (default 'artwork');
 * each row in artwork_assets points at one storage object.
 *
 * Routes:
 *
 *   GET /api/account/artwork
 *     → { assets: [{ id, label, mimeType, sizeBytes, downloadUrl,
 *                    createdAt, ownerScope: 'personal'|'org' }] }
 *     downloadUrl is a signed URL valid for 1 hour.
 *
 *   POST /api/account/artwork?action=upload-url   body: { filename, label, mimeType, scope? }
 *     - scope ∈ {'personal','org'}; defaults to 'org' for business users.
 *     - Returns a SIGNED PUT URL the browser uses to upload directly to
 *       Supabase Storage. We pre-insert the artwork_assets row so the
 *       upload is tracked; on upload failure the caller can DELETE it.
 *     → { id, uploadUrl, storagePath, expiresInSeconds }
 *
 *   DELETE /api/account/artwork    body: { id }
 *     - Removes both the storage object and the artwork_assets row.
 *
 * Bucket setup (see ACCOUNTS-SETUP.md): the bucket should be PRIVATE.
 * RLS on storage.objects should allow read/write only via the service-
 * role key (which is what this endpoint uses). Customers never see direct
 * bucket URLs — only the signed URLs we return.
 * ========================================================================= */

const { requireUser, setCorsHeaders, readJsonBody } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');
const { requireBusiness, getDefaultOrg } = require('../_lib/business');

const BUCKET = process.env.ARTWORK_BUCKET || 'artwork';
const SIGNED_URL_TTL = 3600;          // 1 hour for downloads
const UPLOAD_URL_TTL = 600;           // 10 minutes for uploads
const MAX_BYTES      = 25 * 1024 * 1024;  // 25 MB per file

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  // Business-only.
  try { await requireBusiness(supabase, user.id); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'business gate failed' }); }

  // Resolve the user's org (lazy-creates if first time).
  let org;
  try { org = await getDefaultOrg(supabase, user.id); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'org lookup failed' }); }

  // ------------------------------------------------------------
  // GET — list assets visible to this user
  // ------------------------------------------------------------
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('artwork_assets')
      .select('id, user_id, organization_id, label, storage_path, mime_type, size_bytes, width_px, height_px, created_at')
      .or(`user_id.eq.${user.id},organization_id.eq.${org.id}`)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ error: error.message });

    // Sign download URLs in parallel.
    const out = [];
    for (const row of data || []) {
      const { data: signed } = await supabase
        .storage.from(BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL);
      out.push({
        id:          row.id,
        label:       row.label,
        mimeType:    row.mime_type,
        sizeBytes:   row.size_bytes,
        widthPx:     row.width_px,
        heightPx:    row.height_px,
        downloadUrl: signed?.signedUrl || null,
        createdAt:   row.created_at,
        ownerScope:  row.organization_id ? 'org' : 'personal'
      });
    }
    return res.status(200).json({ assets: out });
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  // ------------------------------------------------------------
  // POST ?action=upload-url — pre-sign a PUT URL
  // ------------------------------------------------------------
  if (req.method === 'POST' && (req.query?.action === 'upload-url' || body.action === 'upload-url')) {
    const filename = String(body.filename || '').trim();
    const label    = String(body.label || filename).trim().slice(0, 200);
    const mimeType = String(body.mimeType || 'application/octet-stream');
    const scope    = body.scope === 'personal' ? 'personal' : 'org';

    if (!/^[A-Za-z0-9._ -]{1,120}$/.test(filename)) {
      return res.status(400).json({ error: 'filename must be 1–120 chars of letters, digits, dot, dash, space, underscore' });
    }
    if (body.sizeBytes && Number(body.sizeBytes) > MAX_BYTES) {
      return res.status(413).json({ error: `file exceeds ${MAX_BYTES} byte limit` });
    }

    const folder       = scope === 'personal' ? `u/${user.id}` : `o/${org.id}`;
    const stamp        = Date.now();
    const safeName     = filename.replace(/\s+/g, '_');
    const storagePath  = `${folder}/${stamp}_${safeName}`;

    // Insert the row first so a failed upload leaves a deletable record
    // the user can clean up via DELETE.
    const insertRow = {
      label, storage_path: storagePath, mime_type: mimeType,
      size_bytes: body.sizeBytes ? Number(body.sizeBytes) : null
    };
    if (scope === 'personal') insertRow.user_id         = user.id;
    else                      { insertRow.organization_id = org.id; insertRow.user_id = user.id; }

    const { data: row, error: insErr } = await supabase
      .from('artwork_assets').insert(insertRow).select('id').single();
    if (insErr) return res.status(500).json({ error: insErr.message });

    const { data: signed, error: sErr } = await supabase
      .storage.from(BUCKET)
      .createSignedUploadUrl(storagePath);
    if (sErr) {
      // Roll back the row so we don't leave orphans.
      await supabase.from('artwork_assets').delete().eq('id', row.id);
      return res.status(500).json({ error: sErr.message });
    }

    return res.status(200).json({
      id:                row.id,
      uploadUrl:         signed.signedUrl,
      uploadToken:       signed.token || null,
      storagePath,
      expiresInSeconds:  UPLOAD_URL_TTL
    });
  }

  // ------------------------------------------------------------
  // DELETE — remove asset
  // ------------------------------------------------------------
  if (req.method === 'DELETE') {
    if (!body.id) return res.status(400).json({ error: 'id required' });

    const { data: row, error } = await supabase
      .from('artwork_assets')
      .select('id, user_id, organization_id, storage_path')
      .eq('id', body.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!row)  return res.status(404).json({ error: 'asset not found' });
    // Ownership: caller is the uploader OR a member of the owning org.
    const owns = row.user_id === user.id || row.organization_id === org.id;
    if (!owns) return res.status(403).json({ error: 'forbidden' });

    // Best-effort storage delete first; row delete is the source of truth.
    try { await supabase.storage.from(BUCKET).remove([row.storage_path]); }
    catch (e) { console.warn('[artwork] storage delete failed:', e.message); }

    const { error: delErr } = await supabase
      .from('artwork_assets').delete().eq('id', row.id);
    if (delErr) return res.status(500).json({ error: delErr.message });
    return res.status(204).end();
  }

  return res.status(400).json({ error: 'unknown action' });
};
