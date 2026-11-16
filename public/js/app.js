var url = window.location.href;
var swLocation = "/sw.js";

var swReg;

if (navigator.serviceWorker) {
  if (url.includes("localhost")) {
    swLocation = "/sw.js";
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker.register(swLocation).then(function (reg) {
      swReg = reg;
      swReg.pushManager.getSubscription().then(verificaSuscripcion);
    });
  });
}

// Referencias de jQuery
var googleMapKey = "AIzaSyA5mjCwx1TRLuBAjwQw84WE6h5ErSe7Uj8";

var titulo = $("#titulo");
var nuevoBtn = $("#nuevo-btn");
var salirBtn = $("#salir-btn");
var cancelarBtn = $("#cancel-btn");
var postBtn = $("#post-btn");
var avatarSel = $("#seleccion");
var timeline = $("#timeline");

var modal = $("#modal");
var modalAvatar = $("#modal-avatar");
var avatarBtns = $(".seleccion-avatar");
var txtMensaje = $("#txtMensaje");

var btnActivadas = $(".btn-noti-activadas");
var btnDesactivadas = $(".btn-noti-desactivadas");

var btnLocation = $("#location-btn");

var modalMapa = $(".modal-mapa");

var btnTomarFoto = $("#tomar-foto-btn");
var btnPhoto = $("#photo-btn");
var contenedorCamara = $(".camara-contenedor");

// Actividad 7 - Referencias del espacio de grabación de video
var btnVideo = $("#video-btn");
var btnGrabarVideo = $("#grabar-video-btn");
var btnDetenerVideo = $("#detener-video-btn");
var contenedorVideo = $(".video-contenedor");
var estadoGrabacion = $("#grabacion-estado");
var tiempoGrabacion = $("#tiempo-grabacion");

var lat = null;
var lng = null;
var foto = null;
var ultimaFotoCompartible = null;
var ultimoMensajeCopiable = null;

// Actividad 7 - Estado de la grabación de video
var video = null;
var temporizadorGrabacion = null;
var segundosGrabacion = 0;
var DURACION_MAXIMA = 30000; // ms

// Actividad 3 - Estado del seguimiento continuo de la ubicación
var watchId = null;
var ultimoDibujo = null;
var UMBRAL_MOVIMIENTO = 0.0001; // ~11 m: filtra el ruido del GPS
var erroresSeguidos = 0;

// Actividad 4 - Antigüedad máxima aceptada para reutilizar la ubicación
var MAX_ANTIGUEDAD = 60000; // ms
var ultimaPosicion = null;

// Actividad 6 - Tiempo máximo de espera para obtener la ubicación
var TIEMPO_MAXIMO = 5000; // ms
var temporizadorDemora = null;
var avisoDemora = null;

// El usuario, contiene el ID del héroe seleccionado
var usuario;

// Init de la camara class
// document.getElementById('player');
const camara = new Camara($("#player")[0]);

// Actividad 7 - Segunda instancia para el espacio de video
const camaraVideo = new Camara($("#player-video")[0]);

// ===== Codigo de la aplicación

// URL del mapa estático de Google para una coordenada dada
function urlMapa(lat, lng) {
  return `https://www.google.com/maps/embed/v1/view?key=${googleMapKey}&center=${lat},${lng}&zoom=17`;
}

function crearMensajeHTML(mensaje, personaje, lat, lng, foto, video) {
  var content = `
    <li class="animated fadeIn fast"
        data-user="${personaje}"
        data-mensaje="${mensaje}"
        data-tipo="mensaje">

        <div class="avatar">
            <img src="img/avatars/${personaje}.jpg">
        </div>
        <div class="bubble-container">
            <div class="bubble">
                <h3>@${personaje}</h3>
                <br/>
                ${mensaje}
                `;

  if (foto) {
    content += `
                <br>
                <img class="foto-mensaje" src="${foto}">
        `;
  }

  if (video) {
    content += `
                <br>
                <video class="video-mensaje" src="${video}" controls></video>
        `;
  }

  // Actividad 2 y 3 - Botones de copiar y compartir dentro de la burbuja
  content += `
                <div class="bubble-acciones">
                    <button class="btn-copiar-msg" title="Copiar mensaje">
                        <i class="fa fa-copy"></i>
                    </button>
                    <button class="btn-compartir-msg" title="Compartir mensaje">
                        <i class="fa fa-share-alt"></i>
                    </button>
                </div>
            </div>        
            <div class="arrow"></div>
        </div>
    </li>
    `;

  if (lat) {
    crearMensajeMapa(lat, lng, personaje);
  }

  lat = null;
  lng = null;

  $(".modal-mapa").remove();

  timeline.prepend(content);
  cancelarBtn.click();
}

function crearMensajeMapa(lat, lng, personaje) {
  let content = `
    <li class="animated fadeIn fast"
        data-tipo="mapa"
        data-user="${personaje}"
        data-lat="${lat}"
        data-lng="${lng}">
                <div class="avatar">
                    <img src="img/avatars/${personaje}.jpg">
                </div>
                <div class="bubble-container">
                    <div class="bubble">
                        <iframe
                            width="100%"
                            height="250"
                            frameborder="0" style="border:0"
                            src="${urlMapa(lat, lng)}" allowfullscreen>
                            </iframe>
                    </div>
                    
                    <div class="arrow"></div>
                </div>
            </li> 
    `;

  timeline.prepend(content);
}

// Globals
function logIn(ingreso) {
  if (ingreso) {
    nuevoBtn.removeClass("oculto");
    salirBtn.removeClass("oculto");
    timeline.removeClass("oculto");
    avatarSel.addClass("oculto");
    modalAvatar.attr("src", "img/avatars/" + usuario + ".jpg");
  } else {
    nuevoBtn.addClass("oculto");
    salirBtn.addClass("oculto");
    timeline.addClass("oculto");
    avatarSel.removeClass("oculto");

    titulo.text("Seleccione Personaje");
  }
}

// Seleccion de personaje
avatarBtns.on("click", function () {
  usuario = $(this).data("user");

  titulo.text("@" + usuario);

  logIn(true);
});

// Boton de salir
salirBtn.on("click", function () {
  logIn(false);
});

// Boton de nuevo mensaje
nuevoBtn.on("click", function () {
  modal.removeClass("oculto");
  modal.animate(
    {
      marginTop: "-=1000px",
      opacity: 1,
    },
    200,
  );
});

// Boton de cancelar mensaje
cancelarBtn.on("click", function () {
  if (!modal.hasClass("oculto")) {
    // Actividad 3 - el modal se cierra, el GPS ya no hace falta
    detenerSeguimiento();

    // Actividad 7 - Al cerrar se descarta la grabación y se apaga todo
    cerrarGrabacionVideo();
    camara.apagar();
    contenedorCamara.addClass("oculto");
    video = null;

    modal.animate(
      {
        marginTop: "+=1000px",
        opacity: 0,
      },
      200,
      function () {
        modal.addClass("oculto");
        modalMapa.addClass("oculto");
        txtMensaje.val("");
      },
    );
  }
});

// Boton de enviar mensaje
postBtn.on("click", function () {
  var mensaje = txtMensaje.val();
  if (mensaje.length === 0) {
    cancelarBtn.click();
    return;
  }

  // Actividad 3 - Ya tenemos la coordenada que se va a enviar
  detenerSeguimiento();

  var data = {
    mensaje: mensaje,
    user: usuario,
    lat: lat,
    lng: lng,
    foto: foto,
    video: video,
  };

  fetch("api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((res) => res.json())
    .then((res) => console.log("app.js", res))
    .catch((err) => console.log("app.js error:", err));

  crearMensajeHTML(mensaje, usuario, lat, lng, foto, video);

  // Actividad 3 - Limpiar también las coordenadas, no solo la foto
  lat = null;
  lng = null;
  foto = null;
  video = null; // Actividad 7
});

// Obtener mensajes del servidor
function getMensajes() {
  fetch("api")
    .then((res) => res.json())
    .then((posts) => {
      console.log(posts);

      posts.forEach((post) =>
        crearMensajeHTML(
          post.mensaje,
          post.user,
          post.lat,
          post.lng,
          post.foto,
          post.video,
        ),
      );
    });
}

getMensajes();

// Detectar cambios de conexión
function isOnline() {
  if (navigator.onLine) {
    // tenemos conexión
    // console.log('online');
    $.mdtoast("Online", {
      interaction: true,
      interactionTimeout: 1000,
      actionText: "OK!",
    });
  } else {
    // No tenemos conexión
    $.mdtoast("Offline", {
      interaction: true,
      actionText: "OK",
      type: "warning",
    });
  }
}

window.addEventListener("online", isOnline);
window.addEventListener("offline", isOnline);

isOnline();

// Notificaciones
function verificaSuscripcion(activadas) {
  if (activadas) {
    btnActivadas.removeClass("oculto");
    btnDesactivadas.addClass("oculto");
  } else {
    btnActivadas.addClass("oculto");
    btnDesactivadas.removeClass("oculto");
  }
}

function enviarNotificacion() {
  const notificationOpts = {
    body: "Este es el cuerpo de la notificación",
    icon: "img/icons/icon-72x72.png",
  };

  const n = new Notification("Hola Mundo", notificationOpts);

  n.onclick = () => {
    console.log("Click");
  };
}

function notificarme() {
  if (!window.Notification) {
    console.log("Este navegador no soporta notificaciones");
    return;
  }

  if (Notification.permission === "granted") {
    // new Notification('Hola Mundo! - granted');
    enviarNotificacion();
  } else if (
    Notification.permission !== "denied" ||
    Notification.permission === "default"
  ) {
    Notification.requestPermission(function (permission) {
      console.log(permission);

      if (permission === "granted") {
        // new Notification('Hola Mundo! - pregunta');
        enviarNotificacion();
      }
    });
  }
}

// notificarme();

// Get Key
function getPublicKey() {
  // fetch('api/key')
  //     .then( res => res.text())
  //     .then( console.log );

  return (
    fetch("api/key")
      .then((res) => res.arrayBuffer())
      // returnar arreglo, pero como un Uint8array
      .then((key) => new Uint8Array(key))
  );
}

// getPublicKey().then( console.log );
btnDesactivadas.on("click", function () {
  if (!swReg) return console.log("No hay registro de SW");

  getPublicKey().then(function (key) {
    swReg.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      })
      .then((res) => res.toJSON())
      .then((suscripcion) => {
        // console.log(suscripcion);
        fetch("api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(suscripcion),
        })
          .then(verificaSuscripcion)
          .catch(cancelarSuscripcion);
      });
  });
});

function cancelarSuscripcion() {
  swReg.pushManager.getSubscription().then((subs) => {
    subs.unsubscribe().then(() => verificaSuscripcion(false));
  });
}

btnActivadas.on("click", function () {
  cancelarSuscripcion();
});

// Crear mapa en el modal
function mostrarMapaModal(lat, lng) {
  var url = urlMapa(lat, lng);
  var mapa = $(".modal-mapa");

  // Actividad 3 - Reutilizar el mapa en vez de recrear el iframe
  if (mapa.length) {
    mapa.find("iframe").attr("src", url);
    return;
  }

  var content = `
            <div class="modal-mapa">
                <iframe
                    width="100%"
                    height="250"
                    frameborder="0"
                    src="${url}" allowfullscreen>
                    </iframe>
            </div>
    `;

  modal.append(content);
}

// Sección 11 - Recursos Nativos

// Actividad 1 - ¿El navegador soporta geolocalización?
function geolocalizacionDisponible() {
  if (!("geolocation" in navigator) || !navigator.geolocation) {
    console.warn("Geolocalización NO soportada por este navegador");
    $.mdtoast("Este navegador no soporta geolocalización", {
      interaction: true,
      interactionTimeout: 3000,
      actionText: "Ok!",
      type: "warning",
    });

    return false;
  }
  if (!window.isSecureContext) {
    console.warn("Geolocalización bloqueada: se requiere HTTPS o localhost");
    $.mdtoast("La geolocalización requiere HTTPS o localhost", {
      interaction: true,
      interactionTimeout: 3000,
      actionText: "Ok!",
      type: "warning",
    });

    return false;
  }

  console.log("Geolocalización soportada por el navegador");
  return true;
}

// Actividad 2 - Código de error de la geolocalización a texto entendible
function mensajeErrorGeolocalizacion(error) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Permiso de ubicación denegado. Habilítalo en el navegador para ver el mapa.";

    case error.POSITION_UNAVAILABLE:
      return "La ubicación no está disponible en este momento.";

    case error.TIMEOUT:
      return "Se agotó el tiempo de espera para obtener la ubicación.";

    default:
      return "No fue posible obtener la ubicación del dispositivo.";
  }
}

// Actividad 2 - Avisar el error de geolocalización al usuario
function avisarErrorGeolocalizacion(error) {
  console.error("Error de geolocalización:", error);

  $.mdtoast(mensajeErrorGeolocalizacion(error), {
    interaction: true,
    interactionTimeout: 5000,
    actionText: "Ok!",
    type: "warning",
  });
}

// Actividad 2 - Limpiar el mapa y las coordenadas obsoletas
function limpiarEstadoUbicacion() {
  $(".modal-mapa").remove();
  ultimoDibujo = null;
  lat = null;
  lng = null;
}

// Actividad 2 - Error definitivo: ya no tiene sentido seguir buscando
function mostrarErrorGeolocalizacion(error) {
  limpiarEstadoUbicacion();
  avisarErrorGeolocalizacion(error);
}

// Actividad 3 - Detener el seguimiento (si no, el GPS sigue en segundo plano)
function detenerSeguimiento() {
  detenerTemporizadorDemora(); // Actividad 6

  if (watchId === null) return;

  navigator.geolocation.clearWatch(watchId);
  watchId = null;
  ultimoDibujo = null; // para que al reabrir el mapa siempre se dibuje

  console.log("Seguimiento de ubicación detenido");
}

// Actividad 4 - ¿La ubicación guardada sigue siendo reciente?
function ubicacionReciente() {
  if (!ultimaPosicion) return false;

  return Date.now() - ultimaPosicion.timestamp < MAX_ANTIGUEDAD;
}

// Actividad 3 - Redibujar solo si hubo desplazamiento real
function actualizarMapaModal(lat, lng) {
  if (ultimoDibujo) {
    var dLat = Math.abs(lat - ultimoDibujo.lat);
    var dLng = Math.abs(lng - ultimoDibujo.lng);

    if (dLat < UMBRAL_MOVIMIENTO && dLng < UMBRAL_MOVIMIENTO) return;
  }

  ultimoDibujo = { lat: lat, lng: lng };
  mostrarMapaModal(lat, lng);
}

// Actividad 5 - Opciones de la geolocalización según la precisión pedida
function opcionesUbicacion(altaPrecision) {
  return {
    enableHighAccuracy: altaPrecision,
    maximumAge: MAX_ANTIGUEDAD,
    timeout: TIEMPO_MAXIMO, // Actividad 6
  };
}

// Actividad 6 - Avisa si la ubicación no llega dentro del tiempo máximo
function iniciarTemporizadorDemora() {
  detenerTemporizadorDemora();

  temporizadorDemora = setTimeout(() => {
    avisoDemora = $.mdtoast(
      `No se obtuvo la ubicación en ${TIEMPO_MAXIMO / 1000} s`,
      {
        interaction: true,
        interactionTimeout: 4000,
        actionText: "Ok!",
        type: "warning",
      },
    );
  }, TIEMPO_MAXIMO);
}

// Actividad 6 - Cancela la espera y retira el aviso si ya estaba en pantalla
function detenerTemporizadorDemora() {
  clearTimeout(temporizadorDemora);
  temporizadorDemora = null;

  if (avisoDemora) {
    avisoDemora.hide();
    avisoDemora = null;
  }
}

function iniciarSeguimiento() {
  const avisoCargando = $.mdtoast("Cargando mapa...", {
    interaction: true,
    interactionTimeout: 2000,
    actionText: "Ok!",
  });

  // El aviso se cierra con el primer resultado (posición o error)
  let avisoPendiente = true;
  const cerrarAvisoCarga = () => {
    if (!avisoPendiente) return;

    avisoCargando.hide();
    avisoPendiente = false;
  };

  let altaPrecision = true;
  let reintentado = false;

  const arrancar = () => {
    erroresSeguidos = 0;

    iniciarTemporizadorDemora(); // Actividad 6

    // Actividad 3 - watchPosition: se ejecuta en cada cambio de posición
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        cerrarAvisoCarga();
        detenerTemporizadorDemora(); // Actividad 6
        erroresSeguidos = 0; // llegó una posición: el seguimiento está sano

        console.log(pos);
        // Actividad 5 - Se registra la precisión para poder comparar
        console.log(
          `Precisión: ${Math.round(pos.coords.accuracy)} m (alta precisión: ${altaPrecision})`,
        );

        actualizarMapaModal(pos.coords.latitude, pos.coords.longitude);

        lat = pos.coords.latitude;
        lng = pos.coords.longitude;

        // Actividad 4 - Se guarda con su momento para poder reutilizarla
        ultimaPosicion = {
          lat: lat,
          lng: lng,
          timestamp: pos.timestamp || Date.now(),
        };
      },
      // Segundo argumento: se ejecuta cuando la ubicación falla
      (error) => {
        cerrarAvisoCarga();
        detenerTemporizadorDemora(); // Actividad 6

        // Si el usuario negó el permiso no hay nada que esperar
        if (error.code === error.PERMISSION_DENIED) {
          detenerSeguimiento();
          mostrarErrorGeolocalizacion(error);
          return;
        }

        // Actividad 5 - Si la alta precisión falla se reintenta una vez en modo normal
        if (altaPrecision && !reintentado) {
          reintentado = true;
          altaPrecision = false;

          console.log(
            "Alta precisión no disponible, se reintenta en modo normal",
          );
          $.mdtoast("Alta precisión no disponible, se usa el modo normal", {
            interaction: true,
            interactionTimeout: 3000,
            actionText: "Ok!",
            type: "warning",
          });

          detenerSeguimiento();
          arrancar();
          return;
        }

        erroresSeguidos++;

        // Códigos 2 y 3 son fallos momentáneos: el watch se recupera solo
        if (erroresSeguidos === 1 || erroresSeguidos % 10 === 0) {
          avisarErrorGeolocalizacion(error);
        }
      },
      opcionesUbicacion(altaPrecision),
    );
  };

  arrancar();
}

// Obtener la geolocalización
btnLocation.on("click", () => {
  // console.log('Botón geolocalización');

  if (!geolocalizacionDisponible()) return;

  // Actividad 4 - Si la ubicación guardada aún es reciente se reutiliza
  if (ubicacionReciente()) {
    const edad = Math.round((Date.now() - ultimaPosicion.timestamp) / 1000);
    console.log(`Ubicación reutilizada (${edad}s de antigüedad)`);

    lat = ultimaPosicion.lat;
    lng = ultimaPosicion.lng;
    ultimoDibujo = { lat: lat, lng: lng };

    mostrarMapaModal(lat, lng);
    return;
  }

  // Si el usuario pulsa dos veces el botón no queremos dos seguimientos
  detenerSeguimiento();

  iniciarSeguimiento();
});

// Actividad 7 - Aviso corto para los errores de cámara
function avisarCamara(texto) {
  $.mdtoast(texto, {
    interaction: true,
    interactionTimeout: 3000,
    actionText: "Ok!",
    type: "warning",
  });
}

// Actividad 7 - Valida que el navegador pueda grabar video webm
function grabacionDisponible() {
  if (!window.isSecureContext) {
    avisarCamara("La cámara solo funciona en HTTPS o localhost");
    return false;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    avisarCamara("Este navegador no permite acceder a la cámara");
    return false;
  }

  if (!camaraVideo.soportaGrabacion()) {
    avisarCamara("Este navegador no puede grabar video webm");
    return false;
  }

  return true;
}

// Actividad 7 - Traduce los errores de cámara y grabación a un mensaje claro
function mensajeErrorCamara(error) {
  const nombre = (error && error.name) || "";

  if (nombre === "NotAllowedError" || nombre === "SecurityError") {
    return "Permiso de cámara denegado";
  }

  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") {
    return "No se encontró una cámara disponible";
  }

  if (nombre === "NotReadableError" || nombre === "AbortError") {
    return "La cámara está siendo usada por otra aplicación";
  }

  if (nombre === "SinGrabacion") return "No hay una grabación en curso";
  if (nombre === "InicioFallido") return "No se pudo iniciar la grabación";
  if (nombre === "VideoVacio")
    return "La grabación quedó vacía, intente de nuevo";
  if (nombre === "LecturaFallida") return "No se pudo leer el video grabado";

  return "No se pudo acceder a la cámara";
}

// Actividad 7 - Registra y avisa el error de cámara
function avisarErrorCamara(error) {
  console.log("Error de cámara:", error);
  avisarCamara(mensajeErrorCamara(error));
}

// Actividad 7 - Cronómetro visible mientras se graba
function iniciarTemporizadorGrabacion() {
  detenerTemporizadorGrabacion();

  segundosGrabacion = 0;
  tiempoGrabacion.text("00:00");

  temporizadorGrabacion = setInterval(() => {
    segundosGrabacion++;

    const minutos = String(Math.floor(segundosGrabacion / 60)).padStart(2, "0");
    const segundos = String(segundosGrabacion % 60).padStart(2, "0");

    tiempoGrabacion.text(`${minutos}:${segundos}`);

    // Actividad 7 - Tope de duración: evita videos gigantes en base64
    if (segundosGrabacion * 1000 >= DURACION_MAXIMA) {
      detenerGrabacionVideo(true);
    }
  }, 1000);
}

// Actividad 7 - Detiene el cronómetro de grabación
function detenerTemporizadorGrabacion() {
  clearInterval(temporizadorGrabacion);
  temporizadorGrabacion = null;
}

// Actividad 7 - Deja los controles del video como al inicio
function reiniciarControlesVideo() {
  detenerTemporizadorGrabacion();

  btnGrabarVideo.removeClass("oculto");
  btnDetenerVideo.addClass("oculto");
  estadoGrabacion.addClass("oculto");
  tiempoGrabacion.text("00:00");
}

// Actividad 7 - Cierra el espacio de video y suelta la cámara
function cerrarGrabacionVideo() {
  reiniciarControlesVideo();
  camaraVideo.apagar();
  contenedorVideo.addClass("oculto");
}

// Actividad 7 - Detiene la grabación y guarda el webm resultante
function detenerGrabacionVideo(porTiempo) {
  if (!camaraVideo.estaGrabando()) return;

  detenerTemporizadorGrabacion();

  camaraVideo
    .detenerGrabacion()
    .then((dataUrl) => {
      video = dataUrl;

      const peso = Math.round(dataUrl.length / 1024);
      console.log(
        `Video webm listo (${peso} KB): ${camaraVideo.formatoGrabacion}`,
      );

      // Actividad 7 - Se distingue si el corte fue por el tope de duración
      avisarCamara(
        porTiempo
          ? `Se alcanzó el máximo de ${DURACION_MAXIMA / 1000} s, video guardado`
          : "Video grabado, ya puede enviarlo",
      );

      cerrarGrabacionVideo();
    })
    .catch((error) => {
      avisarErrorCamara(error);
      cerrarGrabacionVideo();
    });
}

// Boton de la camara: funcion flecha para que jQuery no cambie el this
btnPhoto.on("click", () => {
  console.log("Inicializar camara");

  // Actividad 7 - Solo un espacio de cámara abierto a la vez
  cerrarGrabacionVideo();

  contenedorCamara.removeClass("oculto");

  camara.encender().catch((error) => {
    contenedorCamara.addClass("oculto");
    avisarErrorCamara(error);
  });
});

// Boton para tomar la foto
btnTomarFoto.on("click", () => {
  console.log("Botón tomar foto");

  foto = camara.tomarFoto();
  ultimaFotoCompartible = foto;

  camara.apagar();

  // console.log(foto);
});

// Actividad 7 - Abrir el espacio de grabación de video
btnVideo.on("click", () => {
  if (!grabacionDisponible()) return;

  // Solo un espacio de cámara abierto a la vez
  camara.apagar();
  contenedorCamara.addClass("oculto");

  video = null;
  contenedorVideo.removeClass("oculto");
  reiniciarControlesVideo();

  camaraVideo.encender().catch((error) => {
    contenedorVideo.addClass("oculto");
    avisarErrorCamara(error);
  });
});

// Actividad 7 - Empezar a grabar
btnGrabarVideo.on("click", () => {
  if (!camaraVideo.stream) {
    avisarCamara("La cámara aún no está lista");
    return;
  }

  const grabador = camaraVideo.iniciarGrabacion();

  if (!grabador) {
    avisarErrorCamara({ name: "InicioFallido" });
    return;
  }

  console.log(`Grabando en formato: ${camaraVideo.formatoGrabacion}`);

  btnGrabarVideo.addClass("oculto");
  btnDetenerVideo.removeClass("oculto");
  estadoGrabacion.removeClass("oculto");

  iniciarTemporizadorGrabacion();
});

// Actividad 7 - Detener la grabación
btnDetenerVideo.on("click", () => {
  detenerGrabacionVideo();
});

// Share API

// if ( navigator.share ) {
//     console.log('Navegador lo soporta');
// } else {
//     console.log('Navegador NO lo soporta');
// }

// Actividad 2 - Web Share API con verificación y manejo de errores

function puedeCompartir(datos) {
  return navigator.share && navigator.canShare && navigator.canShare(datos);
}

// Actividad 3 - Copiar mensaje al portapapeles
timeline.on("click", ".btn-copiar-msg", async function (evento) {
  evento.stopPropagation();

  const mensaje = $(this).closest("li").data("mensaje");

  if (!mensaje) {
    $.mdtoast("Este mensaje no tiene texto para copiar", {
      interaction: true,
      interactionTimeout: 2000,
      type: "warning",
    });
    return;
  }

  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    $.mdtoast("Portapapeles no disponible (requiere HTTPS o localhost)", {
      interaction: true,
      interactionTimeout: 4000,
      actionText: "Ok!",
      type: "warning",
    });
    return;
  }

  try {
    await navigator.clipboard.writeText(mensaje);
    $.mdtoast("Mensaje copiado al portapapeles", {
      interaction: true,
      interactionTimeout: 2000,
    });
  } catch (error) {
    console.error("Error al copiar:", error);
    $.mdtoast("No se pudo copiar el mensaje", {
      interaction: true,
      interactionTimeout: 3000,
      actionText: "Ok!",
      type: "warning",
    });
  }
});

// Actividad 2 - Compartir mensaje con Web Share API
timeline.on("click", ".btn-compartir-msg", async function (evento) {
  evento.stopPropagation();

  const li = $(this).closest("li");
  const tipo = li.data("tipo");
  const mensaje = li.data("mensaje");
  const user = li.data("user");
  const lat = li.data("lat");
  const lng = li.data("lng");

  const shareOpts = {
    title: `@${user}`,
    text: mensaje || "Mensaje del chat",
  };

  if (tipo === "mapa") {
    shareOpts.text = "Ubicación compartida desde Chat para Superhéroes";
    shareOpts.url = `https://www.google.com/maps/@${lat},${lng},15z`;
  }

  if (!navigator.share) {
    $.mdtoast("Este navegador no soporta Web Share API", {
      interaction: true,
      interactionTimeout: 3000,
      actionText: "Ok!",
      type: "warning",
    });
    return;
  }

  try {
    await navigator.share(shareOpts);
    console.log("Compartido exitosamente");
  } catch (error) {
    if (error.name === "AbortError") {
      console.log("Compartir cancelado por el usuario");
      return;
    }
    console.error("Error al compartir:", error);
    $.mdtoast("No se pudo compartir", {
      interaction: true,
      interactionTimeout: 3000,
      actionText: "Ok!",
      type: "warning",
    });
  }
});

// Botón del panel de capacidades
$("#btn-compartir").on("click", async function () {
  const datos = {
    title: "Chat para Superhéroes",
    text: "¡Mira esta aplicación PWA!",
    url: window.location.href,
  };

  if (!navigator.share) {
    $.mdtoast("Web Share API no soportada en este navegador", {
      interaction: true,
      interactionTimeout: 3000,
      actionText: "Ok!",
      type: "warning",
    });
    return;
  }

  try {
    await navigator.share(datos);
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Error:", error);
    }
  }
});

// Compartir una foto (requiere convertir dataURL a File)
async function compartirFoto(dataUrl) {
  if (!navigator.canShare) {
    $.mdtoast("Compartir archivos no soportado", {
      interaction: true,
      interactionTimeout: 3000,
      type: "warning",
    });
    return;
  }

  // Convertir dataURL base64 a Blob
  const respuesta = await fetch(dataUrl);
  const blob = await respuesta.blob();
  const archivo = new File([blob], "foto.jpg", { type: "image/jpeg" });

  const datos = {
    files: [archivo],
    title: "Foto del chat",
  };

  if (navigator.canShare(datos)) {
    try {
      await navigator.share(datos);
    } catch (error) {
      if (error.name !== "AbortError") console.error(error);
    }
  } else {
    $.mdtoast("Este navegador no puede compartir imágenes", {
      interaction: true,
      interactionTimeout: 3000,
      type: "warning",
    });
  }
}

// Actividad 1 - Panel de capacidades nativas

// Vibración
$("#btn-vibrar").on("click", function () {
  if ("vibrate" in navigator) {
    navigator.vibrate([200, 100, 200]);
    $.mdtoast("Vibración activada", {
      interaction: true,
      interactionTimeout: 2000,
    });
  } else {
    $.mdtoast("Vibración no soportada", {
      interaction: true,
      interactionTimeout: 2000,
      type: "warning",
    });
  }
});

// Batería
$("#btn-bateria").on("click", async function () {
  if ("getBattery" in navigator) {
    try {
      const battery = await navigator.getBattery();
      const nivel = Math.round(battery.level * 100);
      const cargando = battery.charging ? "Cargando" : "Descargando";
      $.mdtoast(`Batería: ${nivel}% (${cargando})`, {
        interaction: true,
        interactionTimeout: 4000,
      });
    } catch (e) {
      $.mdtoast("No se pudo obtener el estado de la batería", {
        interaction: true,
        interactionTimeout: 3000,
        type: "warning",
      });
    }
  } else {
    $.mdtoast("API de batería no soportada", {
      interaction: true,
      interactionTimeout: 3000,
      type: "warning",
    });
  }
});

// Red
$("#btn-red").on("click", function () {
  const conn =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;
  if (conn) {
    const tipo = conn.effectiveType || "desconocido";
    const downlink = conn.downlink ? `${conn.downlink} Mbps` : "no disponible";
    $.mdtoast(`Red: ${tipo} (${downlink})`, {
      interaction: true,
      interactionTimeout: 4000,
    });
  } else {
    $.mdtoast("API de red no soportada", {
      interaction: true,
      interactionTimeout: 3000,
      type: "warning",
    });
  }
});

$("#btn-compartir-foto").on("click", function () {
  if (!ultimaFotoCompartible) {
    $.mdtoast("Primero toma una foto desde el modal de nuevo mensaje", {
      interaction: true,
      interactionTimeout: 3000,
      actionText: "Ok!",
      type: "warning",
    });
    return;
  }
  compartirFoto(ultimaFotoCompartible);
});

// Actividad 3 - Copiar texto al portapapeles
$("#btn-copiar").on("click", async function () {
  if (!ultimoMensajeCopiable) {
    $.mdtoast("Primero toca un mensaje en la línea de tiempo", {
      interaction: true,
      interactionTimeout: 3000,
      actionText: "Ok!",
      type: "warning",
    });
    return;
  }

  // Verificar que la API esté disponible (requiere HTTPS/localhost)
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    $.mdtoast("Portapapeles no disponible (requiere HTTPS o localhost)", {
      interaction: true,
      interactionTimeout: 4000,
      actionText: "Ok!",
      type: "warning",
    });
    return;
  }

  try {
    await navigator.clipboard.writeText(ultimoMensajeCopiable);
    $.mdtoast("Mensaje copiado al portapapeles", {
      interaction: true,
      interactionTimeout: 2000,
    });
  } catch (error) {
    console.error("Error al copiar:", error);
    $.mdtoast("No se pudo copiar el mensaje", {
      interaction: true,
      interactionTimeout: 3000,
      actionText: "Ok!",
      type: "warning",
    });
  }
});

// Actividad 4 - Exportar mensajes a JSON y guardar en archivo local

// Recolectar todos los mensajes de la timeline en un arreglo
function obtenerMensajesTimeline() {
  const mensajes = [];

  $("#timeline li").each(function () {
    const li = $(this);
    mensajes.push({
      tipo: li.data("tipo") || "mensaje",
      user: li.data("user") || null,
      mensaje: li.data("mensaje") || null,
      lat: li.data("lat") || null,
      lng: li.data("lng") || null,
      fecha: new Date().toISOString(),
    });
  });

  return mensajes;
}

// Guardar un Blob como archivo: API moderna con fallback clásico
async function guardarArchivo(blob, nombreSugerido) {
  // Detectar si la API moderna está disponible y no estamos en iframe
  const soportaFileSystem =
    "showSaveFilePicker" in window &&
    (() => {
      try {
        return window.self === window.top;
      } catch {
        return false;
      }
    })();

  if (soportaFileSystem) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: nombreSugerido,
        types: [
          {
            description: "Archivo JSON",
            accept: { "application/json": [".json"] },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      $.mdtoast("Archivo guardado correctamente", {
        interaction: true,
        interactionTimeout: 2000,
      });
      return;
    } catch (error) {
      // El usuario canceló el diálogo: no es un error real
      if (error.name === "AbortError") {
        console.log("Exportación cancelada por el usuario");
        return;
      }
      console.error("Error con showSaveFilePicker:", error);
      // Si falla por otra razón, caer al fallback
    }
  }

  // Fallback universal: descarga directa
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreSugerido;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);

  $.mdtoast("Archivo descargado a la carpeta de descargas", {
    interaction: true,
    interactionTimeout: 3000,
  });
}

// Botón de exportar
$("#btn-exportar").on("click", async function () {
  const mensajes = obtenerMensajesTimeline();

  if (mensajes.length === 0) {
    $.mdtoast("No hay mensajes para exportar", {
      interaction: true,
      interactionTimeout: 2500,
      actionText: "Ok!",
      type: "warning",
    });
    return;
  }

  const json = JSON.stringify(mensajes, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  const fecha = new Date().toISOString().slice(0, 10);
  const nombre = `mensajes-chat-${fecha}.json`;

  await guardarArchivo(blob, nombre);
});

// Actividad 5 - Screen Wake Lock API
let wakeLockSentinel = null;

// Verificar si la API está disponible en este contexto
function wakeLockDisponible() {
  return "wakeLock" in navigator;
}

// Solicitar el wake lock
async function solicitarWakeLock() {
  if (!wakeLockDisponible()) {
    $.mdtoast("Screen Wake Lock no soportado (requiere HTTPS)", {
      interaction: true,
      interactionTimeout: 3000,
      actionText: "Ok!",
      type: "warning",
    });
    return false;
  }

  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");

    // El navegador puede liberarlo por su cuenta (batería, ocultar pestaña, etc.)
    wakeLockSentinel.addEventListener("release", () => {
      console.log("Wake Lock liberado por el navegador");
      wakeLockSentinel = null;
      // Si el usuario aún quiere mantenerlo, reflejar en UI
      if ($("#wake-lock-toggle").is(":checked")) {
        $.mdtoast("La pantalla puede apagarse (el sistema liberó el bloqueo)", {
          interaction: true,
          interactionTimeout: 3000,
          type: "warning",
        });
      }
    });

    console.log("Wake Lock activo");
    return true;
  } catch (error) {
    console.error("Error al solicitar Wake Lock:", error.name, error.message);
    $.mdtoast("No se pudo mantener la pantalla encendida", {
      interaction: true,
      interactionTimeout: 3000,
      actionText: "Ok!",
      type: "warning",
    });
    return false;
  }
}

// Liberar el wake lock manualmente
async function liberarWakeLock() {
  if (wakeLockSentinel) {
    await wakeLockSentinel.release();
    wakeLockSentinel = null;
    console.log("Wake Lock liberado manualmente");
  }
}

// Al volver a la página, re-solicitar si el usuario lo tenía activado
document.addEventListener("visibilitychange", async () => {
  if (
    document.visibilityState === "visible" &&
    $("#wake-lock-toggle").is(":checked")
  ) {
    await solicitarWakeLock();
  }
});

// Configurar el checkbox (mostrar solo si la API está disponible)
if (wakeLockDisponible()) {
  $("#wake-lock-label").show();

  $("#wake-lock-toggle").on("change", async function () {
    if ($(this).is(":checked")) {
      const ok = await solicitarWakeLock();
      if (!ok) $(this).prop("checked", false);
    } else {
      await liberarWakeLock();
    }
  });
} else {
  console.log("Wake Lock API no disponible en este contexto");
}

// Actividad 6 - Web Bluetooth API (GATT)

function bluetoothDisponible() {
  if (!navigator.bluetooth) {
    $.mdtoast("Web Bluetooth no soportado (usa Chrome/Edge en HTTPS)", {
      interaction: true,
      interactionTimeout: 4000,
      actionText: "Ok!",
      type: "warning",
    });
    return false;
  }
  return true;
}

// Parsear un valor de característica a texto legible
function parsearValorGATT(dataView) {
  const bytes = [];
  for (let i = 0; i < dataView.byteLength; i++) {
    bytes.push(dataView.getUint8(i));
  }
  return bytes;
}

$("#btn-bluetooth").on("click", async function () {
  if (!bluetoothDisponible()) return;

  // Verificar disponibilidad del adaptador (opcional, puede fallar si el usuario lo bloqueó)
  try {
    const disponible = await navigator.bluetooth.getAvailability();
    if (!disponible) {
      $.mdtoast("Bluetooth no disponible en este dispositivo", {
        interaction: true,
        interactionTimeout: 3000,
        actionText: "Ok!",
        type: "warning",
      });
      return;
    }
  } catch (e) {
    console.log("getAvailability no disponible:", e);
  }

  try {
    // Paso 1: Solicitar dispositivo (el usuario elige de la lista)
    // Usamos acceptAllDevices para permitir cualquier dispositivo BLE cercano
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ["battery_service", "heart_rate", "device_information"],
    });

    console.log("Dispositivo seleccionado:", device.name, device.id);
    $.mdtoast(`Conectando a ${device.name || "dispositivo"}...`, {
      interaction: true,
      interactionTimeout: 2000,
    });

    // Paso 2: Conectar al servidor GATT
    const server = await device.gatt.connect();
    console.log("GATT conectado");

    // Paso 3: Obtener servicios primarios
    const services = await server.getPrimaryServices();
    console.log("Servicios encontrados:", services.length);

    let resumen = `Conectado a ${device.name || "dispositivo"}\nServicios: `;
    const uuids = services.map((s) => s.uuid);
    resumen += uuids.length > 0 ? uuids.join(", ") : "ninguno";

    // Intentar leer la característica de batería si existe
    try {
      const batteryService = await server.getPrimaryService("battery_service");
      const batteryChar =
        await batteryService.getCharacteristic("battery_level");
      const valor = await batteryChar.readValue();
      const nivel = valor.getUint8(0);
      resumen += `\nBatería: ${nivel}%`;
    } catch (e) {
      console.log("Servicio de batería no disponible:", e.message);
    }

    $.mdtoast(resumen, {
      interaction: true,
      interactionTimeout: 8000,
      actionText: "Ok!",
    });

    // Desconectar después de leer (para no dejar el enlace abierto)
    device.gatt.disconnect();
    console.log("GATT desconectado");
  } catch (error) {
    console.error("Error Bluetooth:", error.name, error.message);

    let mensaje = "No se pudo conectar al dispositivo";
    if (error.name === "NotFoundError") {
      mensaje = "No se seleccionó ningún dispositivo";
    } else if (
      error.name === "SecurityError" ||
      error.name === "NotAllowedError"
    ) {
      mensaje =
        "Permiso de Bluetooth denegado o contexto no seguro (requiere HTTPS)";
    } else if (error.name === "NetworkError") {
      mensaje =
        "El dispositivo no está disponible o ya está conectado a otro equipo";
    }

    $.mdtoast(mensaje, {
      interaction: true,
      interactionTimeout: 5000,
      actionText: "Ok!",
      type: "warning",
    });
  }
});
