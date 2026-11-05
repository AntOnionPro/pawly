/// <reference path="../pb_data/types.d.ts" />

// Comments are stored without surrounding spaces, so a comment of only spaces is empty
// (and the `text` field rejects it as required).
function trimComment(e) {
  e.record.set('text', e.record.getString('text').trim());
  e.next();
}

onRecordCreateRequest(trimComment, 'comments');
onRecordUpdateRequest(trimComment, 'comments');
