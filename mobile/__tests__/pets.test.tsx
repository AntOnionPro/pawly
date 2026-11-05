import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import type PocketBase from 'pocketbase';

import * as api from '@/features/pets/api';
import { petAge } from '@/features/pets/age';
import { PetForm, validatePet } from '@/features/pets/PetForm';
import { PetList } from '@/features/pets/PetList';
import { PetProfile } from '@/features/pets/PetProfile';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { confirm } from '@/utils/confirm';

import { renderWith, serverError, signedIn } from '../test-utils/render';

jest.mock('@/components/DateField', () => jest.requireActual('../test-utils/mocks/DateField'));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
jest.mock('@/features/pets/api', () => ({
  ...jest.requireActual('@/features/pets/api'),
  listPets: jest.fn(),
  getPet: jest.fn(),
  createPet: jest.fn(),
  updatePet: jest.fn(),
  deletePet: jest.fn(),
}));

const mockRouter = { push: jest.fn() };

const LUNA: api.Pet = {
  id: 'p1',
  collectionId: 'pets',
  ownerId: 'u1',
  ownerUsername: 'luna',
  name: 'Firulais',
  species: 'dog',
  breed: 'Xoloitzcuintle',
  birthDate: '2022-03-01',
  photo: '',
  previousOwnerId: '',
  adoptedAt: '',
};

const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(confirm).mockResolvedValue(true);
});

describe('petAge', () => {
  const today = new Date(2026, 10, 5);

  it('counts years from the first birthday', () => {
    expect(petAge('2024-11-05', today)).toEqual({ unit: 'years', count: 2 });
    expect(petAge('2025-11-05', today)).toEqual({ unit: 'years', count: 1 });
  });

  it('counts months before one year', () => {
    expect(petAge('2025-11-06', today)).toEqual({ unit: 'months', count: 11 });
    expect(petAge('2026-09-05', today)).toEqual({ unit: 'months', count: 2 });
  });

  it('says "newborn" before one month', () => {
    expect(petAge('2026-10-20', today)).toEqual({ unit: 'newborn' });
  });

  it('has no age without a valid past date', () => {
    expect(petAge('', today)).toBeNull();
    expect(petAge('2027-01-01', today)).toBeNull();
  });
});

describe('pet API helpers', () => {
  it('maps records and keeps only the date part of the birth date', () => {
    const pet = api.toPet({
      id: 'p1',
      collectionId: 'c1',
      collectionName: 'pets',
      owner: 'u1',
      name: 'Michi',
      species: 'unicorn',
      breed: '',
      birthDate: '2020-01-02 00:00:00.000Z',
      photo: 'michi.jpg',
      expand: { owner: { id: 'u1', collectionId: 'x', collectionName: 'users', username: 'sol' } },
    });
    expect(pet).toMatchObject({
      ownerId: 'u1',
      ownerUsername: 'sol',
      species: 'other',
      birthDate: '2020-01-02',
    });
  });

  it('creates the pet for its owner with a form', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'p9', collectionId: 'c', owner: 'u1' });
    const client = { collection: () => ({ create }) } as unknown as PocketBase;
    await jest
      .requireActual<typeof api>('@/features/pets/api')
      .createPet(client, 'u1', { name: ' Kiwi ', species: 'bird', breed: '', birthDate: '' });
    const form = create.mock.calls[0]?.[0] as FormData;
    expect(form.get('owner')).toBe('u1');
    expect(form.get('name')).toBe('Kiwi');
    expect(form.get('species')).toBe('bird');
  });
});

describe('validatePet', () => {
  it('requires a name and a species', () => {
    expect(validatePet({ name: ' ', species: '', breed: '', birthDate: '' })).toEqual({
      name: 'errors.required',
      species: 'errors.required',
    });
    expect(validatePet({ name: 'Luna', species: 'cat', breed: '', birthDate: '' })).toEqual({});
  });
});

describe('PetForm', () => {
  it('creates a pet', async () => {
    jest.mocked(api.createPet).mockResolvedValue(LUNA);
    const onSaved = jest.fn();
    await renderWith(<PetForm onSaved={onSaved} />, signedIn());
    await screen.findByLabelText('Nombre');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getAllByText('Este campo es obligatorio.')).toHaveLength(2);
    expect(api.createPet).not.toHaveBeenCalled();

    await type('Nombre', 'Firulais');
    await fireEvent.press(screen.getByRole('radio', { name: 'Perro' }));
    await type('Raza (opcional)', 'Xoloitzcuintle');
    await type('Fecha de nacimiento aproximada (opcional)', '2022-03-01');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(api.createPet).toHaveBeenCalledWith(expect.anything(), 'u1', {
      name: 'Firulais',
      species: 'dog',
      breed: 'Xoloitzcuintle',
      birthDate: '2022-03-01',
    });
    expect(onSaved).toHaveBeenCalledWith(LUNA);
  });

  it('edits and deletes an existing pet', async () => {
    jest.mocked(api.updatePet).mockResolvedValue({ ...LUNA, name: 'Firu' });
    const onSaved = jest.fn();
    const onDeleted = jest.fn();
    await renderWith(<PetForm pet={LUNA} onSaved={onSaved} onDeleted={onDeleted} />, signedIn());
    expect(await screen.findByDisplayValue('Firulais')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Perro', checked: true })).toBeOnTheScreen();
    await type('Nombre', 'Firu');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(api.updatePet).toHaveBeenCalledWith(
      expect.anything(),
      'p1',
      expect.objectContaining({ name: 'Firu' }),
    );
    expect(onSaved).toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar mascota' }));
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: '¿Eliminar a Firulais?', destructive: true }),
    );
    expect(api.deletePet).toHaveBeenCalledWith(expect.anything(), 'p1');
    expect(onDeleted).toHaveBeenCalled();
  });

  it('shows server errors', async () => {
    jest
      .mocked(api.createPet)
      .mockRejectedValue(serverError(400, { birthDate: { code: 'birthdate_future' } }));
    await renderWith(<PetForm onSaved={jest.fn()} />, signedIn());
    await type('Nombre', 'Futuro');
    await fireEvent.press(screen.getByRole('radio', { name: 'Gato' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText('Elige una fecha válida.')).toBeOnTheScreen();
  });
});

describe('PetList', () => {
  it("shows the user's pets and the button to add one", async () => {
    jest.mocked(api.listPets).mockResolvedValue([LUNA]);
    await renderWith(<PetList ownerId="u1" canAdd />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Firulais, Perro' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pet/[id]', params: { id: 'p1' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar mascota' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/pet/new');
  });

  it('invites to add the first pet', async () => {
    jest.mocked(api.listPets).mockResolvedValue([]);
    await renderWith(<PetList ownerId="u1" canAdd />, signedIn());
    expect(
      await screen.findByText('Agrega a tus mascotas para etiquetarlas en tus publicaciones.'),
    ).toBeOnTheScreen();
  });
});

describe('PetProfile', () => {
  it('shows the pet, its age and its owner', async () => {
    await renderWith(<PetProfile pet={{ ...LUNA, birthDate: '2020-01-01' }} />, signedIn());
    expect(await screen.findByText('Firulais')).toBeOnTheScreen();
    expect(screen.getByText('Perro · Xoloitzcuintle')).toBeOnTheScreen();
    expect(screen.getByText(/^\d+ años$/)).toBeOnTheScreen();
    expect(screen.getByText('Dueño: @luna')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Editar mascota' })).toBeNull();
  });

  it("opens the owner's profile", async () => {
    const onPressOwner = jest.fn();
    await renderWith(<PetProfile pet={LUNA} onPressOwner={onPressOwner} />, signedIn());
    await fireEvent.press(await screen.findByRole('link', { name: 'Dueño: @luna' }));
    expect(onPressOwner).toHaveBeenCalledWith('u1');
  });

  it('lets the owner edit it', async () => {
    const onEdit = jest.fn();
    await renderWith(<PetProfile pet={LUNA} onEdit={onEdit} />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar mascota' }));
    expect(onEdit).toHaveBeenCalled();
  });
});
