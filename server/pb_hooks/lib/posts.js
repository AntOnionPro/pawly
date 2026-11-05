// Shared post rules, loaded from the hooks with require(). Plain JavaScript (no PocketBase
// globals) so the Node tests can also import it.

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic'];

function isPhoto(name) {
  const extension = String(name).split('.').pop().toLowerCase();
  return PHOTO_EXTENSIONS.includes(extension);
}

/**
 * Returns `null` if the post is valid, or `{ field, code, message }`.
 * - `text`: the post text.
 * - `mediaCount`: files the post will have (kept and new).
 * - `newFiles`: files uploaded in this request, as `{ name, size }`.
 * - `author`: id of the author.
 * - `petOwners`: owner id of each tagged pet ('' if the pet does not exist).
 * - `isRepost`: whether the post reposts another one (its text is an optional comment, and
 *   it cannot have files or pets).
 */
function postError({ text, mediaCount, newFiles, author, petOwners, isRepost }) {
  if (isRepost) {
    if (mediaCount > 0) {
      return {
        field: 'media',
        code: 'repost_media',
        message: 'A repost cannot have photos or videos.',
      };
    }
    if ((petOwners || []).length > 0) {
      return { field: 'pets', code: 'repost_pets', message: 'A repost cannot tag pets.' };
    }
    return null;
  }
  if (!String(text || '').trim() && mediaCount === 0) {
    return {
      field: 'text',
      code: 'post_empty',
      message: 'Write something or add a photo or video.',
    };
  }
  const bigPhoto = (newFiles || []).find(
    (file) => isPhoto(file.name) && file.size > MAX_PHOTO_SIZE,
  );
  if (bigPhoto) {
    return { field: 'media', code: 'photo_too_large', message: 'Photos can be up to 10 MB.' };
  }
  if ((petOwners || []).some((owner) => owner !== author)) {
    return { field: 'pets', code: 'pet_not_owned', message: 'You can only tag your own pets.' };
  }
  return null;
}

module.exports = { MAX_PHOTO_SIZE, isPhoto, postError };
