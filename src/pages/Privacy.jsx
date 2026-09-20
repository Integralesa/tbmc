export default function Privacy() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-serif text-3xl text-parchment mb-2">Política de Privacidad</h1>
      <p className="text-muted text-sm mb-8">Última actualización: {new Date().getFullYear()}</p>

      <div className="space-y-6 text-parchment/85 text-sm leading-relaxed">
        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">1. Qué datos recolectamos</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Nombre, email y foto de perfil de tu cuenta de Google, al iniciar sesión.</li>
            <li>Las cartas que publiques: título, descripción, precio y hasta 2 fotos.</li>
            <li>Tu historial de pujas (monto y horario) en las subastas donde participaste.</li>
          </ul>
          <p className="mt-2">No pedimos contraseñas propias (usás tu cuenta de Google) ni datos de pago.</p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">2. Para qué usamos estos datos</h2>
          <p>
            Para que la plataforma funcione: mostrar tus publicaciones y pujas, identificarte
            frente a otros usuarios (nombre y foto), y permitir el historial de "mis subastas" y
            "mis pujas" en tu perfil. No usamos tus datos para publicidad ni los vendemos a
            terceros.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">3. Qué es visible para otros usuarios</h2>
          <p>
            Tu nombre y foto de perfil son visibles públicamente en las cartas que publicás y en
            las pujas que hacés (por ejemplo, "Va ganando Juan"). Tu email no se muestra
            públicamente en la plataforma hoy.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">4. Dónde se almacenan los datos</h2>
          <p>
            Usamos servicios de Google Firebase (Authentication, Firestore y Storage) para guardar
            cuentas, subastas, pujas y fotos. Estos datos quedan alojados en la infraestructura de
            Google Cloud, sujeta a sus propias políticas de seguridad.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">5. Tus derechos</h2>
          <p>
            Podés pedir que eliminemos tu cuenta y los datos asociados (publicaciones, pujas)
            contactándonos por los medios que figuren en la plataforma. Tené en cuenta que borrar
            una subasta con pujas activas puede afectar a otros usuarios involucrados en ella.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">6. Cookies y rastreo</h2>
          <p>
            No usamos cookies de publicidad ni rastreo de terceros. Firebase Authentication puede
            usar almacenamiento local del navegador únicamente para mantener tu sesión iniciada.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">7. Cambios a esta política</h2>
          <p>
            Podemos actualizar esta política a medida que la plataforma cambie. Los cambios
            importantes se van a reflejar en esta misma página.
          </p>
        </section>
      </div>
    </div>
  )
}
