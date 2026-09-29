# Spec: On Air Atlas

## Para qué

Felipe está relanzando On Air Music solo. Cada session arranca igual: un lugar que no se repite, saber quién decide, cerrar los números y mandar un mail que no rebote. Hoy eso vive en la cabeza y en chats. La app lo convierte en un objeto: una ficha por lugar, con números que se pueden defender y un mail que se puede mandar.

## Quién la usa

Felipe, solo, desde el celu o la compu. Nadie más. Por eso no hay cuentas ni backend.

## Qué tiene que pasar

1. Abro el mapa y veo las sessions hechas como pines blancos.
2. Toco un punto, la app me dice dónde estoy, le pongo nombre y si es público o privado.
3. Muevo los toggles de la hoja y veo si cierra o no, en dólares, con quién cubre cada rubro.
4. Aprieto imaginar y en menos de un minuto tengo concepto, artista, quién decide, riesgos, mail y prompts.
5. Completo las seis preguntas. Si no están las seis, la ficha me lo marca.
6. Copio la ficha y la pego en la carpeta del plan.

## Qué no hace

- No manda mails, no contacta a nadie, no publica. Reserva total.
- No guarda nada en un servidor. Todo en el navegador.
- No inventa artistas con nombre: sugiere tier y perfil.
- No decide precios: el precio es un input, el desglose es el output.

## Reglas de negocio (de la hoja de producción)

- Internacional US$ 8 a 10 mil con pasajes, lo paga un tercero o no va.
- Técnica US$ 4 a 6 mil, en canje con rental socio por crédito en el video.
- Público: espacio y permisos por Forum. Privado: lugar, barra y hospedaje por la barra.
- Filmación US$ 3 a 4,5 mil y pauta US$ 0,8 a 1,5 mil los pone OAM.
- Seguridad, ambulancia y baños US$ 1,5 a 2,5 mil y producción e imprevistos US$ 1,5 a 2,5 mil salen de tickets.
- Derechos 12 a 24 % del bruto, ticketing 6 a 20 %.
- Barra propia se estima en la mitad de la ticketera.
- No se banca faltante entre socios: si no cierra, la fecha se mueve.

## Reglas de voz para el mail

Las de la skill mi-voz, resumidas en `lib/voz.ts`. Sin `¿`, sin raya, sin punto y coma, voseo, el pedido primero, cierre con pedido concreto o `quedo atento`. La ruta además limpia rayas y signos de apertura si al modelo se le escapan.
