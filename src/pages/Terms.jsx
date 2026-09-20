export default function Terms() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-serif text-3xl text-parchment mb-2">Términos y Condiciones</h1>
      <p className="text-muted text-sm mb-8">Última actualización: {new Date().getFullYear()}</p>

      <div className="space-y-6 text-parchment/85 text-sm leading-relaxed">
        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">1. Qué es esta plataforma</h2>
          <p>
            The Black Market Connections es un espacio para publicar y pujar por cartas coleccionables (TCG)
            entre usuarios. La plataforma <strong>no compra, vende, envía ni cobra</strong> ninguna
            carta: solo facilita el encuentro y la mecánica de subasta entre comprador y vendedor.
            La transacción final (pago, envío, entrega) es responsabilidad exclusiva de las partes
            involucradas.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">2. Cuenta y elegibilidad</h2>
          <p>
            Para publicar o pujar necesitás iniciar sesión con una cuenta de Google. Sos
            responsable de la actividad que ocurra desde tu cuenta. Tenés que ser mayor de edad
            según la legislación de tu país para operar en la plataforma.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">3. Publicar una carta</h2>
          <p>
            Al publicar una carta, declarás que es de tu propiedad, que las fotos son reales de la
            carta que estás ofreciendo, y que la descripción (estado, edición, defectos) es
            precisa. La plataforma no verifica autenticidad, estado ni titularidad de las cartas
            publicadas.
          </p>
          <p className="mt-2">
            Durante los primeros 5 minutos desde que se publica, y siempre que la duración elegida
            no sea "Flash" (10 minutos), podés corregir datos de la publicación (no el precio
            inicial ni las fotos) o cancelarla del todo. Si la cancelás, aunque ya haya pujas
            hechas, esas pujas quedan sin efecto y no se puede reactivar la publicación — hay que
            volver a publicarla. Pasados esos 5 minutos (o si la duración es "Flash"), la
            publicación ya no se puede editar ni cancelar.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">4. Pujar</h2>
          <p>
            Una puja es un compromiso de compra: si tu puja gana la subasta, te comprometés a
            avanzar con la operación con el vendedor. Las subastas pueden extenderse
            automáticamente si se recibe una puja cerca del cierre (regla "anti-sniping"), según la
            duración elegida por el vendedor. El detalle de estas reglas está en la sección
            "Cómo funciona" del proyecto.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">5. Qué no garantizamos</h2>
          <p>
            No garantizamos que el vendedor entregue la carta, que el comprador pague, ni la
            calidad, autenticidad o legalidad de lo publicado. No procesamos pagos ni envíos. No
            mediamos disputas de forma automática (por ahora). Usá el sentido común: verificá al
            otro usuario, pedí fotos adicionales si tenés dudas, y priorizá medios de pago seguros.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">6. Incumplimiento de operaciones</h2>
          <p className="mb-2">
            Ganar una subasta o vender una carta implica el compromiso de completar la operación.
            Si una operación queda sin concretarse por causa de una de las partes (no paga, no
            entrega, corta comunicación, etc.), la otra parte puede reportarlo dentro de la
            plataforma explicando qué pasó.
          </p>
          <p>
            Aplicamos una política progresiva: los primeros dos incumplimientos quedan registrados
            en tu cuenta y vas a ver un aviso en tu perfil. A partir del tercero, la cuenta se
            suspende automáticamente por 2 días; si vuelve a pasar, la sanción escala (7 días, y
            luego de forma permanente). Qué cuenta como incumplimiento lo evalúa el equipo de la
            plataforma caso por caso a partir de lo reportado. Cada incumplimiento deja de contar a
            las 2 semanas de aplicado. Si creés que un incumplimiento o una suspensión fue un
            error, podés escribirnos por los medios de contacto de la plataforma para pedir que lo
            revisemos.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">7. Suspensión de cuentas</h2>
          <p>
            Nos reservamos el derecho de suspender, de forma temporal o permanente, la cuenta de
            cualquier usuario que infrinja estos Términos y Condiciones — incluyendo, entre otros
            motivos, incumplimiento reiterado de operaciones (sección 6), publicación de contenido
            falso o engañoso, uso abusivo de la plataforma, o comportamiento fraudulento hacia otros
            usuarios. La suspensión puede aplicarse con o sin aviso previo, según la gravedad.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">8. Contenido prohibido</h2>
          <p>
            No se pueden publicar cartas falsificadas a sabiendas, contenido ilegal, ofensivo, ni
            fotos que no correspondan al producto real. Nos reservamos el derecho de dar de baja
            publicaciones que incumplan esto.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">9. Marcas registradas</h2>
          <p>
            Los nombres, logos y cartas de Pokémon, Magic: The Gathering, Yu-Gi-Oh!, One Piece y
            demás juegos mencionados pertenecen a sus respectivos dueños. Esta plataforma es un
            proyecto independiente, sin afiliación ni respaldo de esas compañías.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">10. Cambios a estos términos</h2>
          <p>
            Podemos actualizar estos términos a medida que la plataforma cambie. Los cambios
            importantes se van a reflejar en esta misma página.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg text-parchment mb-2">11. Contacto</h2>
          <p>
            Ante dudas sobre estos términos, contactanos por los medios que figuren en la
            plataforma.
          </p>
        </section>
      </div>
    </div>
  )
}
