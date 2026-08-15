const CLOUDINARY_CLOUD = 'ddfkwexvu';
const UPLOAD_PRESET = 'upload_profile_pic'; // unsigned upload preset

/**
 * Determines the Cloudinary resource type from a File object.
 * @param {File} file
 * @returns {'image' | 'video' | 'raw' | null}
 */
function getResourceType(file) {
  if (!file) return null;
  if (file.type.startsWith('image')) return 'image';
  if (file.type.startsWith('video')) return 'video';
  if (file.type.startsWith('application/pdf')) return 'raw';
  return null;
}

/**
 * Uploads a file to Cloudinary and returns the secure URL.
 * @param {File} file
 * @param {string} [uploadPreset] - optional override for upload preset
 * @returns {Promise<string>} Secure URL of the uploaded resource
 */
export async function uploadToCloudinary(file, uploadPreset = UPLOAD_PRESET) {
  if (!file) throw new Error('No file provided.');

  const type = getResourceType(file);
  if (!type) throw new Error(`Unsupported file type: ${file.type}`);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${type}/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Upload failed with status ${res.status}`);
  }

  const data = await res.json();
  return data.secure_url;
}
