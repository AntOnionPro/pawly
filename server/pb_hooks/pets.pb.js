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
