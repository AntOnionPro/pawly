/// <reference path="../pb_data/types.d.ts" />

// Post rules the collection settings cannot express:
// - a post needs text or at least one photo or video;
// - photos are limited to 10 MB (videos keep the 50 MB field limit);
// - only the author's own pets can be tagged.
function validatePost(e) {
  const { postError } = require(`${__hooks}/lib/posts.js`);

  const record = e.record;
  const files = record.getUnsavedFiles('media').map((file) => ({
    name: file.originalName,
    size: file.size,
  }));
  const petOwners = record.getStringSlice('pets').map((id) => {
    try {
      return e.app.findRecordById('pets', id).getString('owner');
    } catch {
      return '';
    }
  });

  const error = postError({
    text: record.getString('text'),
    // Kept files plus the ones uploaded now (unsaved files are not in the string slice).
    mediaCount: record.getStringSlice('media').length + files.length,
    newFiles: files,
    author: record.getString('author'),
    petOwners,
  });
  if (error) {
    throw new BadRequestError('Invalid post.', {
      [error.field]: new ValidationError(error.code, error.message),
    });
  }
  e.next();
}

onRecordCreateRequest(validatePost, 'posts');
onRecordUpdateRequest(validatePost, 'posts');
