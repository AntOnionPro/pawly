import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import type PocketBase from 'pocketbase';

import { AdoptionDetail } from '@/features/adoption/AdoptionDetail';
import { AdoptionForm, validateAdoption } from '@/features/adoption/AdoptionForm';
import { AdoptionList } from '@/features/adoption/AdoptionList';
import * as api from '@/features/adoption/api';
import { PetAdoptionButton } from '@/features/adoption/PetAdoptionButton';
import * as moderationApi from '@/features/moderation/api';
import * as petsApi from '@/features/pets/api';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { confirm } from '@/utils/confirm';

import { authValue, renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
jest.mock('@/features/adoption/api', () => ({
  ...jest.requireActual('@/features/adoption/api'),
  listAdoptions: jest.fn(),
  getPetAdoption: jest.fn(),
  createAdoption: jest.fn(),
  updateAdoption: jest.fn(),
  deleteAdoption: jest.fn(),
}));
jest.mock('@/features/pets/api', () => ({
  ...jest.requireActual('@/features/pets/api'),
  listPets: jest.fn(),
}));
jest.mock('@/features/moderation/api', () => ({
  ...jest.requireActual('@/features/moderation/api'),
  listBlocks: jest.fn(),
}));

const mockRouter = { push: jest.fn() };

const SOL = { ...TEST_USER, id: 'u2', username: 'sol', bio: '' };

const FIRULAIS: petsApi.Pet = {
  id: 'p1',
  collectionId: 'pets',
  ownerId: 'u2',
  name: 'Firulais',
  species: 'dog',
  breed: 'Xoloitzcuintle',
  birthDate: `${new Date().getFullYear() - 2}-01-01`,
  photo: '',
  previousOwnerId: '',
  adoptedAt: '',
};

function adoption(id: string, overrides: Partial<api.Adoption> = {}): api.Adoption {
  return {
    id,
    collectionId: 'adoptions',
    publisherId: 'u2',
    publisher: SOL,
    petId: 'p1',
    pet: FIRULAIS,
    sex: 'male',
    size: 'medium',
    vaccines: 'complete',
    sterilized: true,
    health: 'Sano',
    zone: 'Coyoacán, CDMX',
    requirements: 'Casa con patio',
    description: 'Le encanta jugar',
    media: ['foto_a.jpg'],
    status: 'available',
    adopterId: '',
    adoptedAt: '',
    created: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(moderationApi.listBlocks).mockResolvedValue([]);
  jest
    .mocked(api.listAdoptions)
    .mockResolvedValue({ items: [adoption('a1')], page: 1, hasMore: false });
  jest.mocked(petsApi.listPets).mockResolvedValue([{ ...FIRULAIS, ownerId: 'u1' }]);
});

describe('adoption API helpers', () => {
  const actual = jest.requireActual<typeof api>('@/features/adoption/api');

  it('maps a listing with its pet and publisher', () => {
    const mapped = actual.toAdoption({
      id: 'a1',
      collectionId: 'adoptions',
      collectionName: 'adoptions',
      publisher: 'u2',
      pet: 'p1',
      sex: 'female',
      size: 'small',
      vaccines: 'partial',
      sterilized: false,
      zone: 'Tlalpan',
      media: ['a.jpg'],
      status: 'available',
      expand: {
        pet: { id: 'p1', collectionId: 'pets', collectionName: 'pets', name: 'Luna', owner: 'u2' },
        publisher: { id: 'u2', collectionId: 'users', collectionName: 'users', username: 'sol' },
      },
    });
    expect(mapped).toMatchObject({ sex: 'female', size: 'small', vaccines: 'partial' });
    expect(mapped.pet?.name).toBe('Luna');
    expect(mapped.publisher?.username).toBe('sol');
  });

  it('lists the available ones with the chosen filters, newest first', async () => {
    const getList = jest.fn().mockResolvedValue({ items: [] });
    const client = {
      collection: () => ({ getList }),
      filter: (expression: string, params: Record<string, string>) =>
        expression.replace(/\{:(\w+)\}/g, (_, key: string) => `"${params[key]}"`),
    } as unknown as PocketBase;
    await actual.listAdoptions(client, { species: 'cat', sex: 'female' }, 2);
    expect(getList).toHaveBeenCalledWith(2, 12, {
      filter: 'status = \'available\' && pet.species = "cat" && sex = "female"',
      sort: '-created,-id',
      expand: 'pet,publisher,adopter',
      skipTotal: true,
    });
  });

  it('searches the name, breed, description and zone, and filters by date', async () => {
    const getList = jest.fn().mockResolvedValue({ items: [] });
    const client = {
      collection: () => ({ getList }),
      filter: (expression: string, params: Record<string, unknown>) =>
        expression.replace(/\{:(\w+)\}/g, (_, key: string) =>
          params[key] instanceof Date ? 'DATE' : `"${String(params[key])}"`,
        ),
    } as unknown as PocketBase;
    await actual.listAdoptions(client, { since: 'week', query: ' luna ' }, 1);
    expect(getList.mock.calls[0]?.[2].filter).toBe(
      "status = 'available' && created >= DATE && " +
        '(pet.name ~ "luna" || pet.breed ~ "luna" || description ~ "luna" || zone ~ "luna")',
    );
  });

  const values: api.AdoptionValues = {
    petId: 'p1',
    sex: 'male',
    size: 'large',
    vaccines: 'none',
    sterilized: false,
    health: ' Sano ',
    zone: ' Tlalpan ',
    requirements: '',
    description: '',
    newMedia: [{ uri: 'file:///b.jpg', name: 'b.jpg', type: 'image/jpeg', kind: 'photo' }],
    removedMedia: ['a.jpg'],
  };

  it('publishes with the publisher and the pet, and edits files without replacing them', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'a1', collectionId: 'adoptions' });
    const update = jest.fn().mockResolvedValue({ id: 'a1', collectionId: 'adoptions' });
    const client = { collection: () => ({ create, update }) } as unknown as PocketBase;

    await actual.createAdoption(client, 'u1', { ...values, removedMedia: [] });
    const created = create.mock.calls[0]?.[0] as FormData;
    expect(created.get('publisher')).toBe('u1');
    expect(created.get('pet')).toBe('p1');
    expect(created.get('zone')).toBe('Tlalpan');
    expect(created.get('health')).toBe('Sano');
    expect(created.get('sterilized')).toBe('false');
    expect(created.getAll('media')).toHaveLength(1);

    await actual.updateAdoption(client, 'a1', values);
    const updated = update.mock.calls[0]?.[1] as FormData;
    expect(updated.get('publisher')).toBeNull();
    expect(updated.get('pet')).toBeNull();
    expect(updated.getAll('media-')).toEqual(['a.jpg']);
    expect(updated.getAll('media+')).toHaveLength(1);
  });
});

describe('Adoption tab', () => {
  it('shows each listing and opens it', async () => {
    await renderWith(<AdoptionList />, authValue());
    expect(await screen.findByText('Firulais')).toBeOnTheScreen();
    expect(screen.getByText('Perro · 2 años')).toBeOnTheScreen();
    expect(screen.getByText('Macho · Mediano')).toBeOnTheScreen();
    expect(screen.getByText('Coyoacán, CDMX')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: /^Firulais, Perro/ }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/adoption/[id]',
      params: { id: 'a1' },
    });
  });

  it('shows the animal on the left and the photo on the right', async () => {
    await renderWith(<AdoptionList />, authValue());
    const row = await screen.findByRole('link', { name: /^Firulais, Perro/ });
    expect(within(row).getByTestId('species-icon-dog')).toBeOnTheScreen();
    const photo = within(row).getByTestId('row-photo');
    expect(photo).toBeOnTheScreen();
    // The photo is the last thing in the row, on the right.
    expect(row.children.at(-1)).toBe(photo);
  });

  it('filters by species, size and sex, and clears the filters', async () => {
    await renderWith(<AdoptionList />, authValue());
    await screen.findByText('Firulais');
    await fireEvent.press(screen.getByRole('button', { name: 'Filtros' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Gato' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Hembra' }));
    await waitFor(() =>
      expect(api.listAdoptions).toHaveBeenLastCalledWith(
        expect.anything(),
        { species: 'cat', sex: 'female' },
        1,
      ),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar filtros' }));
    await waitFor(() =>
      expect(api.listAdoptions).toHaveBeenLastCalledWith(expect.anything(), {}, 1),
    );
  });

  it('searches as you type, adds the date filter, and keeps the search when clearing filters', async () => {
    await renderWith(<AdoptionList />, authValue());
    await screen.findByText('Firulais');
    await fireEvent.changeText(screen.getByLabelText('Buscar'), 'luna');
    await waitFor(() =>
      expect(api.listAdoptions).toHaveBeenLastCalledWith(expect.anything(), { query: 'luna' }, 1),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Filtros' }));
    // Each filter is one line that scrolls sideways.
    expect(screen.getByLabelText('Especie').props.horizontal).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'Últimos 7 días' }));
    await waitFor(() =>
      expect(api.listAdoptions).toHaveBeenLastCalledWith(
        expect.anything(),
        { since: 'week', query: 'luna' },
        1,
      ),
    );
    expect(screen.getByRole('button', { name: 'Filtros (1)' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Quitar filtros' }));
    await waitFor(() =>
      expect(api.listAdoptions).toHaveBeenLastCalledWith(expect.anything(), { query: 'luna' }, 1),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Borrar búsqueda' }));
    await waitFor(() =>
      expect(api.listAdoptions).toHaveBeenLastCalledWith(expect.anything(), {}, 1),
    );
  });

  it('says when nothing matches, and hides listings by blocked users', async () => {
    jest.mocked(moderationApi.listBlocks).mockResolvedValue([{ id: 'b1', blockedId: 'u2' }]);
    await renderWith(<AdoptionList />, signedIn());
    expect(await screen.findByText('Por ahora no hay mascotas en adopción.')).toBeOnTheScreen();
  });

  it('sends visitors to sign in to publish, and users to the form', async () => {
    await renderWith(<AdoptionList />, authValue());
    await fireEvent.press(await screen.findByRole('button', { name: 'Dar en adopción' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/sign-in');

    await renderWith(<AdoptionList />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Dar en adopción' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/adoption/new');
  });
});

describe('listing page', () => {
  it('shows the data, requirements and publisher, and links to the pet', async () => {
    const onPressPet = jest.fn();
    const onPressUser = jest.fn();
    await renderWith(
      <AdoptionDetail
        adoption={adoption('a1')}
        onPressPet={onPressPet}
        onPressUser={onPressUser}
      />,
      authValue(),
    );
    expect(await screen.findByRole('header', { name: 'Firulais' })).toBeOnTheScreen();
    expect(screen.getByText('En adopción')).toBeOnTheScreen();
    for (const text of ['Xoloitzcuintle', '2 años', 'Macho', 'Mediano', 'Completas', 'Sí']) {
      expect(screen.getByText(text)).toBeOnTheScreen();
    }
    expect(screen.getByText('Sobre Firulais')).toBeOnTheScreen();
    expect(screen.getByText('Casa con patio')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Editar ficha' })).toBeNull();

    await fireEvent.press(screen.getByRole('link', { name: 'Publicada por @sol' }));
    expect(onPressUser).toHaveBeenCalledWith('u2');
    await fireEvent.press(screen.getByRole('button', { name: 'Ver el perfil de Firulais' }));
    expect(onPressPet).toHaveBeenCalledWith('p1');

    // Visitors who want to report it go to sign in.
    await fireEvent.press(screen.getByRole('button', { name: 'Reportar ficha' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/sign-in');
  });

  it('lets others report the listing', async () => {
    await renderWith(
      <AdoptionDetail adoption={adoption('a1')} onPressPet={jest.fn()} onPressUser={jest.fn()} />,
      signedIn(),
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Reportar ficha' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/report',
      params: { kind: 'adoption', id: 'a1' },
    });
  });

  it('does not let the publisher report their own listing', async () => {
    await renderWith(
      <AdoptionDetail
        adoption={adoption('a1', { publisherId: 'u1', publisher: TEST_USER })}
        onPressPet={jest.fn()}
        onPressUser={jest.fn()}
      />,
      signedIn(),
    );
    expect(await screen.findByRole('header', { name: 'Firulais' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reportar ficha' })).toBeNull();
  });
});

describe('AdoptionForm', () => {
  it('requires a pet, sex, size, vaccines and zone', () => {
    expect(
      validateAdoption({
        petId: '',
        sex: '',
        size: '',
        vaccines: '',
        sterilized: false,
        health: '',
        zone: ' ',
        requirements: '',
        description: '',
      }),
    ).toEqual({
      pet: 'errors.required',
      sex: 'errors.required',
      size: 'errors.required',
      vaccines: 'errors.required',
      zone: 'errors.required',
    });
  });

  it('puts one of your pets up for adoption', async () => {
    const saved = adoption('a9', { publisherId: 'u1' });
    jest.mocked(api.createAdoption).mockResolvedValue(saved);
    const onSaved = jest.fn();
    await renderWith(<AdoptionForm onSaved={onSaved} />, signedIn());

    await fireEvent.press(await screen.findByRole('button', { name: 'Publicar ficha' }));
    expect(screen.getAllByText('Este campo es obligatorio.')).toHaveLength(5);
    expect(api.createAdoption).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('radio', { name: 'Firulais' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Macho' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Grande' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Incompletas' }));
    await fireEvent(screen.getByLabelText('Esterilizada'), 'valueChange', true);
    await fireEvent.changeText(screen.getByLabelText('Zona aproximada'), 'Coyoacán, CDMX');
    await fireEvent.changeText(
      screen.getByLabelText('Requisitos para adoptar (opcional)'),
      'Casa con patio',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar ficha' }));

    expect(api.createAdoption).toHaveBeenCalledWith(expect.anything(), 'u1', {
      petId: 'p1',
      sex: 'male',
      size: 'large',
      vaccines: 'partial',
      sterilized: true,
      health: '',
      zone: 'Coyoacán, CDMX',
      requirements: 'Casa con patio',
      description: '',
      newMedia: [],
      removedMedia: [],
    });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it('says when the pet is already up for adoption', async () => {
    jest
      .mocked(api.createAdoption)
      .mockRejectedValue(serverError(400, { pet: { code: 'pet_already_listed' } }));
    await renderWith(<AdoptionForm petId="p1" onSaved={jest.fn()} />, signedIn());
    expect(await screen.findByRole('radio', { name: 'Firulais', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Hembra' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Chico' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Completas' }));
    await fireEvent.changeText(screen.getByLabelText('Zona aproximada'), 'Tlalpan');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar ficha' }));
    expect(await screen.findByText('Esta mascota ya está en adopción.')).toBeOnTheScreen();
  });

  it('asks to register a pet first', async () => {
    jest.mocked(petsApi.listPets).mockResolvedValue([]);
    await renderWith(<AdoptionForm onSaved={jest.fn()} />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Agregar mascota' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/pet/new');
  });

  it('edits the listing, removes a photo, and deletes it', async () => {
    const current = adoption('a1', { publisherId: 'u1', media: ['foto_a.jpg', 'foto_b.jpg'] });
    jest.mocked(api.updateAdoption).mockResolvedValue(current);
    jest.mocked(confirm).mockResolvedValue(true);
    const onSaved = jest.fn();
    const onDeleted = jest.fn();
    await renderWith(
      <AdoptionForm adoption={current} onSaved={onSaved} onDeleted={onDeleted} />,
      signedIn(),
    );
    expect(await screen.findByDisplayValue('Coyoacán, CDMX')).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: 'Firulais' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar el archivo 1' }));
    await fireEvent.changeText(screen.getByLabelText('Zona aproximada'), 'Tlalpan, CDMX');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(api.updateAdoption).toHaveBeenCalledWith(
      expect.anything(),
      'a1',
      expect.objectContaining({
        zone: 'Tlalpan, CDMX',
        removedMedia: ['foto_a.jpg'],
        newMedia: [],
      }),
    );
    expect(onSaved).toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Borrar ficha' }));
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: '¿Borrar esta ficha?', destructive: true }),
    );
    expect(api.deleteAdoption).toHaveBeenCalledWith(expect.anything(), 'a1');
    expect(onDeleted).toHaveBeenCalled();
  });
});

describe("pet's page", () => {
  it('lets the owner put the pet up for adoption', async () => {
    jest.mocked(api.getPetAdoption).mockResolvedValue(null);
    await renderWith(<PetAdoptionButton pet={FIRULAIS} isOwner />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Dar en adopción' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/adoption/new',
      params: { petId: 'p1' },
    });
  });

  it('opens the listing of a pet up for adoption, for anyone', async () => {
    jest.mocked(api.getPetAdoption).mockResolvedValue(adoption('a1'));
    await renderWith(<PetAdoptionButton pet={FIRULAIS} isOwner={false} />, authValue());
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver ficha de adopción' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/adoption/[id]',
      params: { id: 'a1' },
    });
  });

  it('shows nothing to others when the pet is not up for adoption', async () => {
    jest.mocked(api.getPetAdoption).mockResolvedValue(null);
    await renderWith(<PetAdoptionButton pet={FIRULAIS} isOwner={false} />, authValue());
    await waitFor(() => expect(api.getPetAdoption).toHaveBeenCalled());
    expect(screen.queryByRole('button')).toBeNull();
  });
});
