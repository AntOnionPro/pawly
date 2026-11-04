import type { Resources } from './en';

const es: Resources = {
  tabs: {
    home: 'Inicio',
    adoption: 'Adopción',
    post: 'Publicar',
    rescue: 'Rescate',
    profile: 'Perfil',
  },
  comingSoon: {
    title: 'Próximamente',
    stage: 'Esta sección llega en la etapa {{stage}}.',
  },
  home: {
    title: 'Pawly',
    description: 'Aquí aparecerá el feed de tus mascotas.',
  },
  adoption: {
    title: 'Adopción',
    description: 'Mascotas que buscan hogar y el seguimiento después de adoptarlas.',
  },
  post: {
    title: 'Nueva publicación',
    description: 'Comparte fotos, videos y texto de tus mascotas.',
  },
  rescue: {
    title: 'Rescate',
    description:
      'Animales callejeros que necesitan ayuda y animales perdidos o encontrados cerca de ti.',
  },
  profile: {
    title: 'Perfil',
    description: 'Tu perfil, tus mascotas y tus publicaciones.',
    settings: 'Ajustes',
  },
  settings: {
    title: 'Ajustes',
    theme: {
      title: 'Tema',
      system: 'Sistema',
      light: 'Claro',
      dark: 'Oscuro',
    },
    language: {
      title: 'Idioma',
      system: 'Sistema',
      es: 'Español',
      en: 'English',
    },
    account: 'Cuenta',
    legal: 'Legal',
  },
  auth: {
    signUp: {
      title: 'Crear cuenta',
      username: 'Nombre de usuario',
      usernameHint: '3–30 caracteres: minúsculas, números, punto y guion bajo.',
      email: 'Correo',
      password: 'Contraseña',
      passwordHint: 'Al menos 8 caracteres.',
      passwordConfirm: 'Confirma la contraseña',
      dateOfBirth: 'Fecha de nacimiento',
      dateOfBirthHint: 'Debes tener al menos 13 años. Nunca se muestra en tu perfil.',
      datePlaceholder: 'Elige una fecha',
      acceptTerms: 'Acepto los términos de servicio y el aviso de privacidad',
      readTerms: 'Leer los términos de servicio',
      readPrivacy: 'Leer el aviso de privacidad',
      submit: 'Crear cuenta',
      haveAccount: '¿Ya tienes cuenta? Inicia sesión',
    },
    signIn: {
      title: 'Iniciar sesión',
      email: 'Correo',
      password: 'Contraseña',
      submit: 'Iniciar sesión',
      forgot: '¿Olvidaste tu contraseña?',
      noAccount: '¿Aún no tienes cuenta? Créala',
      resend: 'Reenviar correo de verificación',
      resent: 'Te enviamos un nuevo enlace de verificación.',
    },
    checkEmail: {
      title: 'Revisa tu correo',
      message:
        'Enviamos un enlace a {{email}}. Ábrelo para activar tu cuenta y después inicia sesión.',
      resend: 'Reenviar correo',
      resent: 'Te enviamos un nuevo enlace.',
      goToSignIn: 'Ir a iniciar sesión',
    },
    forgot: {
      title: 'Restablecer contraseña',
      message: 'Escribe tu correo y te enviaremos un enlace para elegir una nueva contraseña.',
      email: 'Correo',
      submit: 'Enviar enlace',
      sent: 'Si existe una cuenta para {{email}}, recibirás un enlace en unos minutos.',
    },
    prompt: {
      title: 'Únete a Pawly',
      profile: 'Crea una cuenta para armar tu perfil y el de tus mascotas.',
      post: 'Crea una cuenta para compartir fotos y videos de tus mascotas.',
      signUp: 'Crear cuenta',
      signIn: 'Iniciar sesión',
    },
  },
  errors: {
    required: 'Este campo es obligatorio.',
    usernameFormat: 'Usa de 3 a 30 caracteres: minúsculas, números, punto y guion bajo.',
    usernameTaken: 'Ese nombre de usuario ya está en uso.',
    emailInvalid: 'Escribe un correo válido.',
    emailTaken: 'Ya existe una cuenta con ese correo.',
    passwordTooShort: 'Usa al menos 8 caracteres.',
    passwordMismatch: 'Las contraseñas no coinciden.',
    passwordWrong: 'La contraseña actual no es correcta.',
    dateRequired: 'Elige tu fecha de nacimiento.',
    dateInvalid: 'Elige una fecha válida.',
    tooYoung: 'Debes tener al menos 13 años para usar Pawly.',
    termsRequired: 'Acepta los términos de servicio y el aviso de privacidad para continuar.',
    tooLong: 'Este texto es demasiado largo.',
    invalid: 'Revisa este campo.',
    invalidCredentials: 'Correo o contraseña incorrectos.',
    unverified: 'Tu correo aún no está verificado. Abre el enlace que te enviamos.',
    network: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
    generic: 'Algo salió mal. Inténtalo de nuevo.',
  },
  legal: {
    draft: 'Borrador. La versión definitiva se publicará antes del lanzamiento.',
    terms: {
      title: 'Términos de servicio',
      useTitle: 'Quién puede usar Pawly',
      useBody:
        'Debes tener al menos 13 años. Eres responsable de tu cuenta y de mantener tu contraseña segura.',
      contentTitle: 'Tu contenido',
      contentBody:
        'Lo que publicas es tuyo. Permites que Pawly lo muestre en la app para que otras personas lo vean. No publiques contenido ofensivo, violento o que maltrate animales, y no ofrezcas animales a la venta.',
      moderationTitle: 'Moderación',
      moderationBody:
        'Cualquiera puede reportar contenido o cuentas. Pawly puede eliminar contenido y suspender cuentas que no cumplan estos términos.',
      deletionTitle: 'Eliminar tu cuenta',
      deletionBody: 'Puedes eliminar tu cuenta cuando quieras desde Ajustes.',
      changesTitle: 'Cambios',
      changesBody: 'Si estos términos cambian, te avisaremos en la app.',
    },
    privacy: {
      title: 'Aviso de privacidad',
      controllerTitle: 'Quién es responsable',
      controllerBody:
        'Pawly es responsable de tus datos personales, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares. Los datos de contacto se publicarán con la versión definitiva.',
      dataTitle: 'Qué datos recabamos',
      dataBody:
        'Tu correo, nombre de usuario, fecha de nacimiento, foto de perfil y bio. En versiones posteriores, también tus publicaciones, mensajes y la ubicación de los reportes de rescate que crees.',
      purposesTitle: 'Para qué los usamos',
      purposesBody:
        'Para crear y operar tu cuenta, comprobar la edad mínima, mantener Pawly seguro y moderar el contenido. Tu correo y tu fecha de nacimiento nunca se muestran a otras personas.',
      sharingTitle: 'Con quién los compartimos',
      sharingBody:
        'No vendemos tus datos. Solo los compartimos con los servicios necesarios para operar Pawly, como el envío de correos y el alojamiento.',
      rightsTitle: 'Tus derechos',
      rightsBody:
        'Puedes acceder a tus datos, rectificarlos, cancelarlos u oponerte a su uso (derechos ARCO). Puedes eliminar tu cuenta y sus datos desde Ajustes.',
      changesTitle: 'Cambios',
      changesBody: 'Si este aviso cambia, te avisaremos en la app.',
    },
  },
};

export default es;
