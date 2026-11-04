/// <reference path="../pb_data/types.d.ts" />

// Pawly accounts: public username, bio and avatar; private birth date and terms acceptance.
// Real names are never stored, so the default `name` field is removed.

function emailBody(textEs, buttonEs, textEn, buttonEn, link) {
  return [
    `<p>Hola:</p><p>${textEs}</p>`,
    `<p><a class="btn" href="${link}" target="_blank" rel="noopener">${buttonEs}</a></p>`,
    '<hr/>',
    `<p>Hello,</p><p>${textEn}</p>`,
    `<p><a class="btn" href="${link}" target="_blank" rel="noopener">${buttonEn}</a></p>`,
    '<p>Pawly</p>',
  ].join('\n');
}

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    users.fields.removeByName('name');
    users.fields.add(
      new TextField({
        name: 'username',
        required: true,
        presentable: true,
        min: 3,
        max: 30,
        pattern: '^[a-z0-9._]+$',
      }),
    );
    users.fields.add(new TextField({ name: 'bio', max: 150 }));
    users.fields.add(new DateField({ name: 'birthdate', required: true, hidden: true }));
    users.fields.add(new DateField({ name: 'termsAcceptedAt', hidden: true }));
    users.addIndex('idx_users_username', true, 'username COLLATE NOCASE', '');

    const avatar = users.fields.getByName('avatar');
    avatar.maxSize = 5 * 1024 * 1024;
    avatar.mimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    avatar.thumbs = ['100x100', '400x400'];

    // Anyone can see a profile; only signed-in users can list them (no public scraping).
    users.listRule = "@request.auth.id != ''";
    users.viewRule = '';
    users.createRule = '';
    users.updateRule = 'id = @request.auth.id';
    users.deleteRule = 'id = @request.auth.id';
    // Only verified accounts can sign in.
    users.authRule = 'verified = true';

    // Emails in Spanish and English: the server does not know the user's language yet.
    users.verificationTemplate = {
      subject: 'Verifica tu correo de {APP_NAME} / Verify your {APP_NAME} email',
      body: emailBody(
        'Confirma tu correo para empezar a usar {APP_NAME}.',
        'Verificar correo',
        'Confirm your email to start using {APP_NAME}.',
        'Verify email',
        '{APP_URL}/_/#/auth/confirm-verification/{TOKEN}',
      ),
    };
    users.resetPasswordTemplate = {
      subject: 'Restablece tu contraseña de {APP_NAME} / Reset your {APP_NAME} password',
      body: emailBody(
        'Recibimos una solicitud para cambiar tu contraseña. Si no fuiste tú, ignora este correo.',
        'Restablecer contraseña',
        'We received a request to change your password. If it was not you, ignore this email.',
        'Reset password',
        '{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}',
      ),
    };

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    users.removeIndex('idx_users_username');
    for (const name of ['username', 'bio', 'birthdate', 'termsAcceptedAt']) {
      users.fields.removeByName(name);
    }
    users.fields.add(new TextField({ name: 'name', max: 255 }));

    users.listRule = 'id = @request.auth.id';
    users.viewRule = 'id = @request.auth.id';
    users.createRule = '';
    users.updateRule = 'id = @request.auth.id';
    users.deleteRule = 'id = @request.auth.id';
    users.authRule = '';

    app.save(users);
  },
);
