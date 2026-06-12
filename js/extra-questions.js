/**
 * Preguntas extra para Democrazy.
 *
 * Este fichero se carga como módulo desde game-enhanced-v2.js, después de js/questions.js.
 * Añade preguntas a las categorías existentes sin tocar GameAPI.js ni sobrescribir las preguntas del repo.
 */
const extraQuestionsByCategory = {
  "fiesta_noche": [
    "¿Quién montaría una fiesta diciendo que será tranquila y acabaría con vecinos opinando?",
    "¿Quién fingiría controlar la noche mientras pierde a medio grupo por el camino?",
    "¿Quién sería capaz de ligar con alguien y olvidarse de su nombre al minuto?",
    "¿Quién haría de relaciones públicas para entrar gratis y terminaría pagando más que todos?",
    "¿Quién convertiría una ronda barata en un agujero negro financiero?",
    "¿Quién mandaría un audio de madrugada que debería venir con abogado?",
    "¿Quién se creería DJ por tener una playlist llamada 'temazos finales final final'?",
    "¿Quién se iría de after solo porque alguien dijo que había patatas?",
    "¿Quién sería el primero en pedir perdón al día siguiente sin saber por qué?",
    "¿Quién llamaría 'noche histórica' a una sucesión de decisiones discutibles?",
    "¿Quién intentaría reconciliar enemigos en la barra y saldría con dos enemigos nuevos?",
    "¿Quién tendría más probabilidades de amanecer con una pulsera de un sitio al que no recuerda haber entrado?"
  ],
  "salseo_drama": [
    "¿Quién soltaría 'yo no digo nada' justo antes de decirlo todo?",
    "¿Quién sería capaz de crear dos bandos por interpretar un emoji?",
    "¿Quién diría que quiere paz mientras reparte cerillas al incendio?",
    "¿Quién guardaría una captura durante años esperando el momento perfecto?",
    "¿Quién pediría neutralidad y luego votaría con el corazón lleno de rencor?",
    "¿Quién haría una pregunta inocente sabiendo que abre una guerra civil?",
    "¿Quién se haría el sorprendido ante un chisme que ya había contado él?",
    "¿Quién convertiría una ruptura ajena en comité de investigación?",
    "¿Quién usaría un silencio incómodo como arma táctica?",
    "¿Quién pediría detalles 'solo para entender' y terminaría dirigiendo el caso?",
    "¿Quién sería capaz de perdonar a alguien y seguir hablándolo cada fin de semana?",
    "¿Quién tendría más talento para meter una pullita envuelta en humor?"
  ],
  "picante_suave": [
    "¿Quién se pondría interesante y acabaría pareciendo que necesita agua?",
    "¿Quién ligaría mejor cuando no intenta ligar y peor cuando se prepara?",
    "¿Quién confundiría tensión romántica con mala cobertura emocional?",
    "¿Quién respondería una historia con una frase que merece reunión de crisis?",
    "¿Quién tendría más peligro con un '¿sigues despierto?' a deshoras?",
    "¿Quién se inventaría señales donde solo había educación básica?",
    "¿Quién sería capaz de mantener un casi algo por pura cabezonería?",
    "¿Quién se haría el duro y caería con el primer cumplido bien puesto?",
    "¿Quién diría que pasa página y seguiría viendo todas las historias?",
    "¿Quién tendría una teoría sentimental basada en una canción compartida?",
    "¿Quién mandaría un mensaje valiente y apagaría el móvil por miedo?",
    "¿Quién sería el más probable en volver a hablar con alguien que no conviene?"
  ],
  "amistad_traiciones": [
    "¿Quién elegiría el mejor sitio para sentarse aunque llegue el último?",
    "¿Quién traicionaría al grupo por no compartir patatas?",
    "¿Quién defendería a un amigo en público y luego le echaría la bronca en privado?",
    "¿Quién tendría más probabilidades de filtrar un secreto por contar demasiado contexto?",
    "¿Quién diría 'yo invito' y luego miraría el ticket como si le hubieran robado?",
    "¿Quién se quedaría con el plan alternativo si el principal se pone difícil?",
    "¿Quién vendería a alguien del grupo para salvarse de una bronca pequeña?",
    "¿Quién sería el amigo que sabe todos tus defectos y los usa con precisión quirúrgica?",
    "¿Quién desaparecería cuando toca organizar y aparecería cuando toca disfrutar?",
    "¿Quién pondría paz solo para poder irse antes?",
    "¿Quién se acordaría de una deuda emocional de 2017?",
    "¿Quién sería capaz de crear una alianza secreta dentro del grupo de amigos?"
  ],
  "redes_tecnologia": [
    "¿Quién publicaría una indirecta y luego fingiría que era sobre una serie?",
    "¿Quién tendría más peligro con acceso al historial de búsqueda del grupo?",
    "¿Quién usaría IA para redactar un mensaje frío y sonar aún más sospechoso?",
    "¿Quién se crearía una cuenta secundaria solo para mirar sin ser visto?",
    "¿Quién borraría una historia después de comprobar exactamente quién la vio?",
    "¿Quién mandaría captura sin recortar y dejaría visible el verdadero drama?",
    "¿Quién sería capaz de discutir con una app de mapas como si fuera su ex?",
    "¿Quién contestaría 'jajaja' a un mensaje que claramente necesitaba terapia?",
    "¿Quién tendría más probabilidades de bloquear y desbloquear por estrategia emocional?",
    "¿Quién subiría una foto casual después de repetirla treinta veces?",
    "¿Quién se sentiría atacado por que alguien no le ponga like?",
    "¿Quién usaría el grupo como diario personal sin consentimiento?"
  ],
  "trabajo_oficina": [
    "¿Quién haría política de oficina diciendo que odia la política de oficina?",
    "¿Quién mandaría un correo con copia a demasiada gente para dejar claro que tiene razón?",
    "¿Quién se apropiaría de una idea ajena diciendo 'sí, justo era lo que pensaba'?",
    "¿Quién fingiría estar ocupado abriendo y cerrando ventanas muy rápido?",
    "¿Quién sería el primero en preguntar por vacaciones en una reunión seria?",
    "¿Quién convertiría un fallo pequeño en auditoría emocional del equipo?",
    "¿Quién se iría de una reunión diciendo que tiene otra y luego no tendría nada?",
    "¿Quién sobreviviría al trabajo solo gracias al café y al resentimiento?",
    "¿Quién sería capaz de decir 'lo vemos rápido' y secuestrar una hora?",
    "¿Quién tendría más talento para sonar profesional sin decir absolutamente nada?",
    "¿Quién haría una presentación con datos dudosos pero mucha seguridad?",
    "¿Quién sería temido por responder 'perdona, no entiendo' en público?"
  ],
  "dinero_cutrerio": [
    "¿Quién dividiría la cuenta con decimales y dignidad intacta?",
    "¿Quién invitaría a una ronda y luego viviría el duelo económico una semana?",
    "¿Quién pediría prestado algo y lo integraría en su patrimonio?",
    "¿Quién defendería una compra absurda diciendo que era 'una oportunidad'?",
    "¿Quién tendría más probabilidades de esconder que está tieso con elegancia?",
    "¿Quién se llevaría comida de un buffet como si preparara un invierno duro?",
    "¿Quién regatearía una amistad por ahorrarse cincuenta céntimos?",
    "¿Quién pediría Bizum por algo que nadie recuerda haber aceptado?",
    "¿Quién llamaría inversión a un capricho completamente indefendible?",
    "¿Quién compraría barato dos veces y lo contaría como estrategia?",
    "¿Quién tendría más drama cuando toca pagar parking que cuando toca decidir su futuro?",
    "¿Quién se apuntaría a un plan gratis aunque no le apetezca nada?"
  ],
  "casa_convivencia": [
    "¿Quién dejaría un plato en remojo hasta que desarrolle personalidad?",
    "¿Quién impondría normas de convivencia que incumple el primer día?",
    "¿Quién escondería desorden en un armario que ya no puede cerrarse?",
    "¿Quién sería capaz de discutir por la temperatura ideal de la casa durante años?",
    "¿Quién tendría una zona prohibida de la habitación que nadie debe mirar?",
    "¿Quién usaría todos los vasos y luego preguntaría si alguien va a fregar?",
    "¿Quién convertiría una visita en inspección técnica de la casa ajena?",
    "¿Quién tendría el mando de la tele secuestrado por derecho divino?",
    "¿Quién sería el vecino que dice no ser cotilla mientras escucha por la ventana?",
    "¿Quién dejaría una bolsa de basura junto a la puerta como promesa rota?",
    "¿Quién llamaría decoración a acumular cosas con valor emocional dudoso?",
    "¿Quién sería capaz de negar que ronca aunque tiemble la pared?"
  ],
  "pueblo_familia": [
    "¿Quién sería capaz de discutir por qué bar pone mejor la tapa como si fuera política nacional?",
    "¿Quién tendría más papeletas de enterarse de un embarazo antes que la familia directa?",
    "¿Quién defendería una tradición rarísima con argumentos sagrados?",
    "¿Quién sería señalado por una tía en una comida con una pregunta letal?",
    "¿Quién se perdería de fiesta y aparecería en la peña equivocada como socio fundador?",
    "¿Quién tendría más peligro con una charanga y una silla de plástico?",
    "¿Quién sabría exactamente quién se ha peleado con quién en cada familia?",
    "¿Quién usaría 'eso en mi pueblo no pasa' sabiendo que sí pasa y peor?",
    "¿Quién convertiría un domingo familiar en interrogatorio judicial?",
    "¿Quién se pondría competitivo pelando patatas para una comida multitudinaria?",
    "¿Quién tendría más posibilidades de salir en una foto municipal con cara rara?",
    "¿Quién sería capaz de iniciar un debate eterno sobre cuál es la mejor fiesta?"
  ],
  "absurdo_total": [
    "¿Quién declararía la guerra a una puerta que no se abre bien?",
    "¿Quién intentaría adoptar emocionalmente una señal de tráfico?",
    "¿Quién pondría una denuncia simbólica a una croqueta fría?",
    "¿Quién fundaría un ministerio para regular las servilletas de bar?",
    "¿Quién sería capaz de discutir con un espejo y perder por cansancio?",
    "¿Quién abriría una escuela para enseñar a mirar con misterio?",
    "¿Quién tendría una rivalidad personal con una máquina expendedora?",
    "¿Quién organizaría un campeonato de andar raro y se lo tomaría en serio?",
    "¿Quién escribiría una biografía no autorizada de una planta?",
    "¿Quién intentaría convencer a una paloma de que cambie de vida?",
    "¿Quién tendría una teoría sobre la personalidad de cada silla?",
    "¿Quién sería detenido en un universo paralelo por exceso de dramatismo?"
  ],
  "verguenza_ajena": [
    "¿Quién saludaría con dos besos cuando tocaba apretón y convertiría la escena en coreografía?",
    "¿Quién diría una frase muy segura y descubriría que no era el momento?",
    "¿Quién mandaría un audio dramático y se oiría el microondas al fondo?",
    "¿Quién intentaría hacer una entrada elegante y se engancharía con algo?",
    "¿Quién se equivocaría de nombre justo después de presumir de memoria?",
    "¿Quién respondería a alguien que hablaba por teléfono con otra persona?",
    "¿Quién se reiría de una broma antes de entenderla y quedaría atrapado?",
    "¿Quién haría una confesión intensa pensando que el micrófono estaba apagado?",
    "¿Quién se pondría nervioso en una situación normal y la haría sospechosa?",
    "¿Quién intentaría pasar desapercibido y tiraría algo ruidoso?",
    "¿Quién viviría un silencio incómodo y lo llenaría con una frase peor?",
    "¿Quién se despediría con demasiada emoción de alguien que acaba de conocer?"
  ],
  "personalidad_manias": [
    "¿Quién necesitaría tener razón incluso cuando el premio es perder amigos?",
    "¿Quién se ofendería con una crítica y luego diría que le encanta la sinceridad?",
    "¿Quién tendría una manía que todos toleran por agotamiento?",
    "¿Quién dramatizaría elegir restaurante como si decidiera un destino vital?",
    "¿Quién sería incapaz de admitir que ha cambiado de opinión?",
    "¿Quién convertiría una pequeña incomodidad en declaración institucional?",
    "¿Quién tendría más probabilidades de dar consejos que jamás aplicaría?",
    "¿Quién se creería tranquilo solo porque explota en voz baja?",
    "¿Quién sería capaz de competir por quién está más cansado?",
    "¿Quién haría una lista para dejar de hacer listas?",
    "¿Quién llevaría años diciendo que va a cambiar algo y defendería que está en proceso?",
    "¿Quién tiene más cara de culpable incluso cuando no ha hecho nada?"
  ],
  "supervivencia_caos": [
    "¿Quién vendería al grupo por una lata de aceitunas en el apocalipsis?",
    "¿Quién intentaría liderar un refugio y sería derrocado por mala organización?",
    "¿Quién se perdería siguiendo una señal que él mismo puso?",
    "¿Quién sería capaz de gastar el último mechero encendiendo una vela decorativa?",
    "¿Quién negociaría con el enemigo porque le cae simpático?",
    "¿Quién haría un inventario y ocultaría snacks como secreto de Estado?",
    "¿Quién sobreviviría por suerte y luego escribiría un manual?",
    "¿Quién sería el primero en gritar 'se acabó' mientras todos siguen bien?",
    "¿Quién intentaría hacer fuego con tutoriales que no ha descargado?",
    "¿Quién convertiría el fin del mundo en grupo de WhatsApp con normas?",
    "¿Quién sería más peligroso con confianza que con miedo?",
    "¿Quién usaría una emergencia para confesar algo que nadie quería saber?"
  ],
  "viajes_aventuras": [
    "¿Quién decidiría la ruta por intuición y acabaría en otro municipio?",
    "¿Quién haría un viaje barato y volvería con una deuda emocional y bancaria?",
    "¿Quién se quejaría del hotel y luego se llevaría todos los jabones?",
    "¿Quién tendría más posibilidades de discutir con seguridad aeroportuaria por nervios?",
    "¿Quién convertiría una excursión sencilla en una odisea con víctimas morales?",
    "¿Quién se enamoraría de alguien que solo le indicó una calle?",
    "¿Quién perdería el grupo y diría que estaba explorando?",
    "¿Quién haría una foto peligrosa por parecer aventurero?",
    "¿Quién elegiría un restaurante terrible porque 'tenía buena vibra'?",
    "¿Quién volvería de dos días fuera hablando como local experto?",
    "¿Quién sería capaz de llevar ropa para todas las estaciones en una mochila imposible?",
    "¿Quién tendría un drama con una maleta que pesa más que sus decisiones?"
  ],
  "comida_gula": [
    "¿Quién defendería que compartir es bonito hasta que tocan sus croquetas?",
    "¿Quién juzgaría a una persona por cómo corta la tortilla?",
    "¿Quién pediría algo ligero y se comería medio plato de todos?",
    "¿Quién escondería comida buena para que no se acabe?",
    "¿Quién provocaría una guerra por la última patata?",
    "¿Quién usaría el hambre como excusa para decir verdades demasiado claras?",
    "¿Quién tendría más peligro en un buffet que en una discusión familiar?",
    "¿Quién probaría una receta rara y obligaría a todos a mentir?",
    "¿Quién llamaría aperitivo a una comida completa?",
    "¿Quién sería capaz de enfadarse si alguien toca su salsa favorita?",
    "¿Quién comería por ansiedad, celebración y aburrimiento en el mismo día?",
    "¿Quién se llevaría sobras con una naturalidad que incomoda?"
  ],
  "familia_navidad": [
    "¿Quién sería interrogado por su vida sentimental antes de sentarse?",
    "¿Quién sacaría un tema prohibido justo cuando todos parecen en paz?",
    "¿Quién se pondría de parte de la abuela aunque no tenga razón?",
    "¿Quién usaría una cena familiar para lanzar indirectas con precisión?",
    "¿Quién fingiría no oír una pregunta incómoda mientras mastica lentamente?",
    "¿Quién sería capaz de discutir por el sitio en la mesa como si fuera herencia?",
    "¿Quién mentiría sobre su vida para sobrevivir a una sobremesa?",
    "¿Quién terminaría arreglando el móvil de todos sin haber aceptado?",
    "¿Quién se sentiría traicionado si no le guardan su plato favorito?",
    "¿Quién haría un brindis bonito y acabaría metiendo presión emocional?",
    "¿Quién tendría más probabilidades de decir 'en esta familia no se puede hablar' después de hablar demasiado?",
    "¿Quién se llevaría comida para casa con una bolsa preparada de antemano?"
  ],
  "bodas_eventos": [
    "¿Quién haría sombra a los protagonistas sin querer y disfrutándolo un poco?",
    "¿Quién se tomaría el photocall como sesión profesional no contratada?",
    "¿Quién sería capaz de llorar en una boda y luego criticar el menú con dureza?",
    "¿Quién ligaría con alguien prohibidísimo para la paz familiar?",
    "¿Quién se quedaría con un centro de mesa y negaría la evidencia?",
    "¿Quién convertiría una comunión en una noche de leyenda?",
    "¿Quién se pondría intenso con la barra libre y filosófico con el camarero?",
    "¿Quién tendría más papeletas de salir en todas las fotos detrás de alguien?",
    "¿Quién haría un discurso que empieza tierno y termina peligroso?",
    "¿Quién juzgaría a todos por cómo bailan y luego bailaría peor?",
    "¿Quién se sentaría en una mesa que no le corresponde y haría amigos allí?",
    "¿Quién cerraría el evento con una frase que se recordará por mal motivo?"
  ],
  "moral_dudosa": [
    "¿Quién devolvería un favor con menos entusiasmo del que recibió?",
    "¿Quién se saltaría una cola y luego explicaría que técnicamente no era cola?",
    "¿Quién usaría una verdad a medias como obra de arte?",
    "¿Quién se comería algo ajeno y dejaría la culpa flotando en el ambiente?",
    "¿Quién apoyaría la norma solo cuando le beneficia?",
    "¿Quién sería capaz de dar un consejo sabiendo que él haría lo contrario?",
    "¿Quién tendría más talento para parecer inocente después de provocar el lío?",
    "¿Quién usaría una disculpa como forma elegante de ganar una discusión?",
    "¿Quién cambiaría la versión de los hechos según quién pregunte?",
    "¿Quién ocultaría información porque 'nadie preguntó exactamente eso'?",
    "¿Quién diría que no juzga mientras juzga con todo el cuerpo?",
    "¿Quién sería peligroso con un pequeño poder y cero supervisión?"
  ],
  "lujo_miseria": [
    "¿Quién viviría una noche como rico y el lunes como superviviente?",
    "¿Quién pediría una copa cara y la bebería con cara de arrepentimiento?",
    "¿Quién haría postureo con algo prestado y lo devolvería tarde?",
    "¿Quién vendería un plan cutre como experiencia minimalista?",
    "¿Quién se sentiría aristócrata por tener servilletas de tela?",
    "¿Quién intentaría entrar en un sitio fino con actitud de embajador?",
    "¿Quién tendría gustos caros y argumentos baratos?",
    "¿Quién fotografiaría un plato diminuto como si fuese arte contemporáneo?",
    "¿Quién llamaría exclusivo a algo porque nadie más quería ir?",
    "¿Quién sería capaz de fingir que entiende de vinos mirando la etiqueta?",
    "¿Quién pondría cara de lujo mientras calcula si puede pedir postre?",
    "¿Quién confundiría elegancia con hablar más bajo y usar palabras raras?"
  ],
  "ofensa_sensibilidad": [
    "¿Quién diría que no le ha molestado y luego cambiaría el tono durante dos días?",
    "¿Quién pediría sinceridad y se arrepentiría al segundo de recibirla?",
    "¿Quién tomaría una broma general como ataque personalizado?",
    "¿Quién se sentiría excluido de un plan que habría rechazado?",
    "¿Quién necesitaría una reunión para aclarar una mirada?",
    "¿Quién perdonaría con la boca y archivaría con el alma?",
    "¿Quién haría una interpretación dramática de un punto final en WhatsApp?",
    "¿Quién pediría perdón por estar enfadado, pero seguiría enfadado?",
    "¿Quién usaría 'tranquilo' como amenaza emocional?",
    "¿Quién sería capaz de llorar por rabia y luego decir que es alergia?",
    "¿Quién convertiría un comentario inocente en tesis de autoestima?",
    "¿Quién se ofendería porque nadie adivinó que quería atención?"
  ],
  "nostalgia_infancia": [
    "¿Quién habría sido el niño que acusaba a todos y luego hacía algo peor?",
    "¿Quién conservaría una vergüenza infantil como si fuera documento clasificado?",
    "¿Quién habría montado un drama por no ser elegido primero?",
    "¿Quién era capaz de mentir fatal y aun así convencer a adultos despistados?",
    "¿Quién habría tenido una etapa de protagonista incomprendido en el recreo?",
    "¿Quién se picaría todavía por una injusticia escolar de hace veinte años?",
    "¿Quién habría sido el primero en crear normas para un juego que nadie pidió?",
    "¿Quién tendría una foto infantil que podría usarse como chantaje amistoso?",
    "¿Quién habría vendido a un amigo para evitar un castigo pequeño?",
    "¿Quién se emocionaría demasiado si vuelve a probar una merienda de infancia?",
    "¿Quién habría tenido un crush secreto que todo el mundo sabía?",
    "¿Quién volvería al colegio y seguiría cayendo en el mismo grupo raro?"
  ],
  "salud_gimnasio": [
    "¿Quién usaría 'vida sana' para justificar comprar accesorios nuevos?",
    "¿Quién tendría una báscula que le cae personalmente mal?",
    "¿Quién se apuntaría a un reto y lo abandonaría con argumentos científicos inventados?",
    "¿Quién haría dieta hasta que alguien abre una bolsa de patatas?",
    "¿Quién subiría un entrenamiento que duró menos que la publicación?",
    "¿Quién se lesionaría intentando demostrar que no está mayor?",
    "¿Quién mediría pasos y luego cogería el ascensor por equilibrio emocional?",
    "¿Quién tendría más probabilidades de confundir hambre con crecimiento personal?",
    "¿Quién se tomaría una ensalada como castigo y una pizza como terapia?",
    "¿Quién hablaría de salud mental mientras ignora todos sus avisos?",
    "¿Quién convertiría una caminata sencilla en competición pasivo-agresiva?",
    "¿Quién compraría proteínas por estética y las dejaría caducar?"
  ],
  "conspiraciones": [
    "¿Quién pensaría que un cambio de algoritmo es un mensaje personal?",
    "¿Quién vería una coincidencia y pediría una pizarra para explicarla?",
    "¿Quién sospecharía de alguien por estar demasiado tranquilo?",
    "¿Quién sería capaz de crear una teoría sobre quién se acabó el hielo?",
    "¿Quién conectaría tres hechos sueltos y declararía que todo encaja?",
    "¿Quién desconfiaría de un sorteo porque ganó alguien con cara rara?",
    "¿Quién usaría 'no tengo pruebas, pero tampoco dudas' como sentencia judicial?",
    "¿Quién pensaría que un sueño raro avisa de una cena incómoda?",
    "¿Quién montaría una investigación porque alguien cambió de foto de perfil?",
    "¿Quién acusaría a una app de escucharle y luego le contaría su vida?",
    "¿Quién tendría más probabilidades de creer una teoría solo porque le beneficia?",
    "¿Quién convencería al grupo de que hay señales donde solo hay mala organización?"
  ],
  "crimen_misterio": [
    "¿Quién parecería culpable incluso preguntando la hora?",
    "¿Quién tocaría la prueba clave diciendo 'solo quería mirar'?",
    "¿Quién haría de detective y acabaría acusando al organizador del juego?",
    "¿Quién tendría una coartada tan elaborada que se vuelve sospechosa?",
    "¿Quién sería capaz de confesar algo que nadie estaba investigando?",
    "¿Quién resolvería el caso por cotilleo, no por inteligencia policial?",
    "¿Quién miraría a todos como sospechosos después de una partida de mesa?",
    "¿Quién escondería una pista porque no pega con su teoría?",
    "¿Quién sería el testigo que recuerda demasiado y demasiado tarde?",
    "¿Quién tendría más probabilidades de incriminarse explicándose?",
    "¿Quién abriría una carpeta mental llamada 'cosas raras de mis amigos'?",
    "¿Quién sería el culpable que todos perdonan porque lo hizo con gracia?"
  ],
  "fama_tele": [
    "¿Quién entraría en un reality como secundario y acabaría destruyendo la convivencia?",
    "¿Quién lloraría en televisión por una nominación imaginaria?",
    "¿Quién tendría una frase viral y la repetiría hasta arruinarla?",
    "¿Quién se creería famoso tras aparecer tres segundos en un vídeo?",
    "¿Quién sería capaz de dar una exclusiva por comida gratis?",
    "¿Quién tendría fans por accidente y enemigos por vocación?",
    "¿Quién montaría una polémica porque no le enfocaron bastante?",
    "¿Quién sería jurado cruel de cosas que tampoco sabe hacer?",
    "¿Quién convertiría una entrevista en confesionario sentimental?",
    "¿Quién pediría camerino para una fiesta en un garaje?",
    "¿Quién tendría más probabilidades de decir 'yo no soy personaje' siendo el personaje?",
    "¿Quién acabaría cancelado por contestar un comentario con demasiada sinceridad?"
  ],
  "universo_paralelo": [
    "¿Quién en otro universo sería dictador amable de una comunidad de vecinos?",
    "¿Quién sería superhéroe pero usaría su poder para evitar conversaciones?",
    "¿Quién abriría una taberna medieval y prohibiría opiniones sobre tortilla?",
    "¿Quién sería el elegido y pediría condiciones laborales?",
    "¿Quién tendría un dragón y lo malcriaría hasta hacerlo insoportable?",
    "¿Quién rompería el multiverso por mirar donde no debe?",
    "¿Quién sería villano por pura mala gestión emocional?",
    "¿Quién en una nave espacial se pelearía por el sitio de la ventana?",
    "¿Quién convertiría una profecía en drama administrativo?",
    "¿Quién sería fantasma y seguiría cotilleando grupos de WhatsApp?",
    "¿Quién sería rey accidental porque nadie quiso el cargo?",
    "¿Quién tendría un superpoder absurdo y aun así se vendría arriba?"
  ],
  "deporte_competicion": [
    "¿Quién haría trampas en un juego amistoso y luego hablaría de mentalidad ganadora?",
    "¿Quién celebraría un punto irrelevante como si hubiera cámaras?",
    "¿Quién perdería y pediría revisar el reglamento que no leyó?",
    "¿Quién se lesionaría por exagerar una celebración?",
    "¿Quién transformaría un pique mínimo en rivalidad histórica?",
    "¿Quién entrenaría en secreto para ganar una tontería de verano?",
    "¿Quién acusaría al viento, al suelo y al destino antes que a sí mismo?",
    "¿Quién usaría estrategia psicológica para ganar a niños?",
    "¿Quién sería capaz de hacer equipo con su enemigo si así gana?",
    "¿Quién tendría más probabilidades de abandonar si no le sale bien rápido?",
    "¿Quién se pondría serio al elegir equipos y heriría sensibilidades?",
    "¿Quién hablaría de fair play justo después de una jugada sucia?"
  ],
  "mentiras_excusas": [
    "¿Quién diría 'cinco minutos' sabiendo que son cuarenta?",
    "¿Quién inventaría una excusa tan buena que merece premio y sospecha?",
    "¿Quién fingiría estar enfermo con demasiados síntomas incompatibles?",
    "¿Quién usaría 'no vi el mensaje' como patrimonio familiar?",
    "¿Quién prometería llegar puntual como quien promete dejar el azúcar?",
    "¿Quién cambiaría la historia según el público sin pestañear?",
    "¿Quién mentiría para evitar un plan y se olvidaría de ocultar las pruebas?",
    "¿Quién pediría perdón con una explicación que empeora todo?",
    "¿Quién tendría una mentira recurrente con nombre propio?",
    "¿Quién fingiría sorpresa ante algo que él mismo provocó?",
    "¿Quién diría que no le importa y lo tendría todo documentado?",
    "¿Quién intentaría usar una verdad pequeña para tapar una mentira gigante?"
  ],
  "citas_amor": [
    "¿Quién convertiría una cita normal en evaluación de compatibilidad a largo plazo?",
    "¿Quién volvería a escribir a alguien solo porque le dio nostalgia una canción?",
    "¿Quién se ilusionaría con una persona que claramente solo pregunta por educación?",
    "¿Quién tendría más peligro con un 'tenemos que ponernos al día'?",
    "¿Quién pediría consejo sentimental y luego haría la opción más caótica?",
    "¿Quién sería capaz de negar celos mientras investiga horarios, likes y amistades?",
    "¿Quién confundiría química con ansiedad y lo llamaría destino?",
    "¿Quién tendría un historial de elegir mal con mucha fe?",
    "¿Quién usaría humor para decir algo demasiado real?",
    "¿Quién se haría el indiferente con la sutileza de una sirena?",
    "¿Quién abriría una conversación antigua para buscar señales retroactivas?",
    "¿Quién sería capaz de volver a caer en la misma historia con distinto peinado?"
  ],
  "coche_transporte": [
    "¿Quién discutiría con el GPS y acabaría obedeciéndolo resentido?",
    "¿Quién sería copiloto sin licencia emocional para opinar tanto?",
    "¿Quién perdería el coche y culparía al parking por cambiar de forma?",
    "¿Quién se bajaría en la parada equivocada y fingiría que era el plan?",
    "¿Quién pondría música en el coche y secuestraría el ambiente?",
    "¿Quién llevaría snacks para un trayecto de ocho minutos?",
    "¿Quién convertiría aparcar en espectáculo de tensión grupal?",
    "¿Quién llegaría demasiado pronto y lo usaría para juzgar a todos?",
    "¿Quién perdería un tren por mirar una tienda que no iba a comprar?",
    "¿Quién tendría más peligro con una rotonda y exceso de seguridad?",
    "¿Quién se dormiría en el coche antes de salir de la calle?",
    "¿Quién pediría parar 'un segundo' y abriría una misión secundaria?"
  ],
  "animales_mascotas": [
    "¿Quién confiaría más en la opinión de un perro que en la de sus amigos?",
    "¿Quién dejaría que una mascota le robe el sitio y pediría perdón?",
    "¿Quién hablaría con un gato como si estuviera negociando una tregua?",
    "¿Quién adoptaría un animal y le montaría personalidad pública?",
    "¿Quién tendría más fotos de una mascota que recuerdos del grupo?",
    "¿Quién juzgaría a alguien porque no saluda bien a su perro?",
    "¿Quién sería manipulado por una mirada animal en tres segundos?",
    "¿Quién usaría voz ridícula con mascotas y lo negaría con violencia?",
    "¿Quién pondría normas a todos menos al animal que manda en casa?",
    "¿Quién creería que su mascota entiende los dramas del grupo?",
    "¿Quién tendría más probabilidades de elegir plan si puede ir el perro?",
    "¿Quién haría una sesión de fotos animal más seria que su DNI?"
  ],
  "musica_baile": [
    "¿Quién cantaría una canción triste con mirada de protagonista traicionado?",
    "¿Quién pondría su canción favorita hasta que todos la odien?",
    "¿Quién se inventaría la letra y encima corregiría a otros?",
    "¿Quién usaría una canción para lanzar una indirecta clarísima?",
    "¿Quién bailaría como si el suelo le debiera dinero?",
    "¿Quién se tomaría karaoke como juicio final de su talento?",
    "¿Quién tendría un gusto musical que divide familias?",
    "¿Quién interrumpiría una discusión porque 'viene la mejor parte'?",
    "¿Quién se pondría nostálgico con una canción objetivamente horrible?",
    "¿Quién haría de DJ y perdería el control democrático en cinco minutos?",
    "¿Quién cantaría mirando a alguien para crear tensión innecesaria?",
    "¿Quién sería capaz de convertir una playlist en autobiografía emocional?"
  ],
  "juegos_competitivos": [
    "¿Quién haría una alianza y la rompería antes de que termine la frase?",
    "¿Quién diría que juega por diversión mientras tiembla de competitividad?",
    "¿Quién acusaría de trampa a la suerte?",
    "¿Quién se leería reglas solo para buscar agujeros legales?",
    "¿Quién perdería y anunciaría que la partida no cuenta?",
    "¿Quién haría farol con la cara más culpable del mundo?",
    "¿Quién convertiría un juego familiar en conflicto generacional?",
    "¿Quién se reiría demasiado al ganar y lo pagaría socialmente?",
    "¿Quién tendría más talento para traicionar con una sonrisa?",
    "¿Quién pactaría con todos y luego se sentiría traicionado cuando le pagan igual?",
    "¿Quién sería capaz de esconder cartas, puntos o información y llamarlo estrategia?",
    "¿Quién necesitaría una revancha para recuperar su identidad?"
  ],
  "planes_cancelaciones": [
    "¿Quién confirmaría un plan y empezaría a buscar excusa inmediatamente?",
    "¿Quién propondría algo caro y luego diría que se puede adaptar?",
    "¿Quién cancelaría por agotamiento social y aparecería en otro sitio?",
    "¿Quién haría una encuesta para todo y luego ignoraría el resultado?",
    "¿Quién se apuntaría a un plan por miedo a perderse algo que no quiere hacer?",
    "¿Quién llegaría tarde y encima preguntaría por qué no han pedido ya?",
    "¿Quién invitaría a alguien extra y lo presentaría como sorpresa inevitable?",
    "¿Quién tendría más probabilidades de organizar un plan que odia?",
    "¿Quién diría 'yo me adapto' y después pondría siete condiciones?",
    "¿Quién dejaría en visto una decisión para no cargar con la culpa?",
    "¿Quién cambiaría el plan a última hora y actuaría como salvador?",
    "¿Quién compraría entradas sin confirmar y luego haría chantaje emocional?"
  ],
  "emergencias_desastres": [
    "¿Quién convertiría quedarse sin batería en emergencia nacional?",
    "¿Quién sería útil en un incendio y desastre absoluto montando una tienda de campaña?",
    "¿Quién llamaría a alguien antes de pensar diez segundos?",
    "¿Quién se bloquearía por un problema pequeño y resolvería uno enorme sin pestañear?",
    "¿Quién asumiría el mando solo porque habla más alto?",
    "¿Quién empeoraría una avería tocando botones con confianza?",
    "¿Quién llevaría un kit de emergencia lleno de cosas inútiles?",
    "¿Quién sería capaz de perder las instrucciones mientras las está leyendo?",
    "¿Quién haría drama porque no hay cobertura y descubriría paz interior por accidente?",
    "¿Quién intentaría arreglar algo con cinta, fe y amenazas?",
    "¿Quién se sentiría héroe por reiniciar el router?",
    "¿Quién sería el primero en decir 'tranquilos' con cara de pánico?"
  ],
  "secreto_inconfesable": [
    "¿Quién tendría una carpeta mental de cosas que jamás debería contar en voz alta?",
    "¿Quién ocultaría un gusto musical porque sabe que el grupo no perdona?",
    "¿Quién habría stalkeado demasiado y ahora sabe información difícil de justificar?",
    "¿Quién tendría una costumbre en soledad que rompería su imagen pública?",
    "¿Quién guardaría un borrador de mensaje que cambiaría una amistad?",
    "¿Quién fingiría odiar algo que en secreto le encanta?",
    "¿Quién tendría una teoría privada sobre todos los presentes?",
    "¿Quién se sabría demasiado bien una canción que dice no conocer?",
    "¿Quién miraría perfiles antiguos y luego limpiaría pruebas?",
    "¿Quién tendría más probabilidades de ensayar una discusión en la ducha?",
    "¿Quién guardaría una captura propia por vergüenza preventiva?",
    "¿Quién sería más fácil de desenmascarar con tres preguntas bien hechas?"
  ],
  "villanos_heroes": [
    "¿Quién sería villano del grupo por tener razón demasiadas veces?",
    "¿Quién salvaría un plan y luego exigiría estatua moral?",
    "¿Quién traicionaría al equipo por una comodidad pequeña?",
    "¿Quién tendría más peligro con un poco de autoridad y una lista?",
    "¿Quién sería héroe solo porque todos los demás están peor organizados?",
    "¿Quién daría un discurso épico antes de hacer algo mínimo?",
    "¿Quién sería capaz de cambiar de bando si le ofrecen comida?",
    "¿Quién tendría un archienemigo imaginario dentro del grupo?",
    "¿Quién resolvería un problema y crearía tres secundarios?",
    "¿Quién sería el villano carismático al que todos perdonan?",
    "¿Quién se sacrificaría dramáticamente para no fregar?",
    "¿Quién tendría un plan maestro que falla por exceso de confianza?"
  ],
  "cultura_random": [
    "¿Quién soltaría un dato inútil y luego se enfadaría si nadie lo valora?",
    "¿Quién corregiría a alguien y convertiría la cena en examen?",
    "¿Quién usaría una referencia cultural como indirecta pasivo-agresiva?",
    "¿Quién defendería una película mala con argumentos de tesis?",
    "¿Quién haría spoiler accidental y luego culparía al tiempo transcurrido?",
    "¿Quién tendría opiniones muy violentas sobre doblajes, finales o rankings?",
    "¿Quién diría 'eso ya lo sabía' aunque lo acaba de aprender?",
    "¿Quién se sentiría superior por conocer un dato que nadie necesita?",
    "¿Quién citaría una frase profunda en un momento ridículo?",
    "¿Quién abriría Wikipedia para ganar una discusión y acabaría en otra pestaña?",
    "¿Quién recomendaría algo intensamente y luego admitiría que no lo ha terminado?",
    "¿Quién sería capaz de explicar un meme como si fuera patrimonio cultural?"
  ],
  "energia_caotica": [
    "¿Quién diría 'tengo una idea' y haría que todos miren las salidas?",
    "¿Quién convertiría una espera de cinco minutos en una actividad ilegal emocionalmente?",
    "¿Quién sería el primero en apoyar una mala idea solo porque suena divertida?",
    "¿Quién entraría en una habitación y alteraría la presión atmosférica social?",
    "¿Quién provocaría un aplauso sin saber por qué?",
    "¿Quién tendría más talento para que algo tranquilo acabe con normas nuevas?",
    "¿Quién haría una apuesta absurda y luego defendería cumplirla por honor?",
    "¿Quién contagiaría entusiasmo por un plan objetivamente peligroso?",
    "¿Quién sería capaz de hacer reír a todos en el peor momento posible?",
    "¿Quién se vendría arriba con una mínima ovación y ya no habría vuelta atrás?",
    "¿Quién sería caos con patas pero útil en emergencias raras?",
    "¿Quién terminaría siendo citado años después con la frase 'por su culpa ahora no se puede'?"
  ]
};

const makeQuestionId = (categoryId, question) =>
  `${categoryId}-${String(question).slice(0, 24).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

const buildQuestionIndex = categories =>
  categories.flatMap(category =>
    (category.questions || []).map(question => ({
      id: makeQuestionId(category.id, question),
      categoryId: category.id,
      categoryName: category.name,
      text: question,
    }))
  );

function applyExtraQuestions() {
  const categories = Array.isArray(window.questionCategories) ? window.questionCategories : [];
  if (!categories.length) return;

  categories.forEach(category => {
    if (!category?.id || !Array.isArray(category.questions)) return;
    const additions = extraQuestionsByCategory[category.id];
    if (!Array.isArray(additions) || !additions.length) return;

    const existing = new Set(category.questions.map(String));
    additions.forEach(question => {
      if (!existing.has(question)) {
        category.questions.push(question);
        existing.add(question);
      }
    });
  });

  window.questionCategories = categories;
  window.questions = buildQuestionIndex(categories);
  window.__democrazyExtraQuestionsLoaded = true;
}

applyExtraQuestions();
