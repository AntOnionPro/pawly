/// <reference path="../pb_data/types.d.ts" />

// Pet rules the collection settings cannot express: the birth date cannot be in the future.
function validatePet(e) {
  const birthDate = e.record.getString('birthDate');
  if (birthDate && new Date(birthDate.replace(' ', 'T')) > new Date()) {
    throw new BadRequestError('Invalid birth date.', {
      birthDate: new ValidationError('birthdate_future', 'The birth date cannot be in the future.'),
    });
  }
  e.next();
}

onRecordCreateRequest(validatePet, 'pets');
onRecordUpdateRequest(validatePet, 'pets');

// Only the server records adoptions (pb_hooks/adoptions.pb.js): owners cannot set or change
// who had the pet before or when it was adopted.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    e.record.set('previousOwner', '');
    e.record.set('adoptedAt', '');
  }
  e.next();
}, 'pets');

onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const original = e.record.original();
    e.record.set('previousOwner', original.get('previousOwner'));
    e.record.set('adoptedAt', original.get('adoptedAt'));
  }
  e.next();
}, 'pets');
