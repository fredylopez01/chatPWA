class Camara {
  constructor(videoNode) {
    this.videoNode = videoNode;
    console.log("Camara Class init");

    // Actividad 7 - Formatos webm que se intentan, del mejor al más básico
    this.formatosVideo = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
  }

  // Actividad 7 - Primer formato webm de la lista que el navegador acepta
  formatoVideoSoportado() {
    if (!window.MediaRecorder) return null;

    return (
      this.formatosVideo.find((formato) =>
        MediaRecorder.isTypeSupported(formato),
      ) || null
    );
  }

  // Actividad 7 - ¿El navegador puede grabar video en webm?
  soportaGrabacion() {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      this.formatoVideoSoportado()
    );
  }

  encender() {
    //Validar la API antes de usarla
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject({ name: "NotSupportedError" });
    }

    return navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { width: 300, height: 300 },
      })
      .then((stream) => {
        this.videoNode.srcObject = stream;
        this.stream = stream;

        return stream;
      });
  }

  apagar() {
    //Si estaba grabando, se corta la grabación
    if (this.estaGrabando()) {
      this.grabador.stop();
    }

    this.grabador = null;

    this.videoNode.pause();

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
  }

  // Actividad 7 - Comprueba si hay una grabación en curso
  estaGrabando() {
    return !!this.grabador && this.grabador.state === "recording";
  }

  // Actividad 7 - Empieza a grabar el stream actual en formato webm
  iniciarGrabacion() {
    if (!this.stream || this.estaGrabando()) return null;

    const formato = this.formatoVideoSoportado();

    if (!formato) return null;

    this.trozos = [];
    this.formatoGrabacion = formato;
    this.grabador = new MediaRecorder(this.stream, { mimeType: formato });

    this.grabador.ondataavailable = (evento) => {
      if (evento.data && evento.data.size > 0) {
        this.trozos.push(evento.data);
      }
    };

    // Se piden trozos cada segundo: si algo falla se pierde poco
    try {
      this.grabador.start(1000);
    } catch (error) {
      this.grabador = null;
      console.log("Error al iniciar MediaRecorder:", error);
      return null;
    }

    return this.grabador;
  }

  // Actividad 7 - Detiene la grabación y devuelve el webm en base64
  detenerGrabacion() {
    return new Promise((resolve, reject) => {
      if (!this.estaGrabando()) {
        reject({ name: "SinGrabacion" });
        return;
      }

      this.grabador.onstop = () => {
        const blob = new Blob(this.trozos, { type: "video/webm" });
        this.trozos = [];

        if (blob.size === 0) {
          reject({ name: "VideoVacio" });
          return;
        }

        const lector = new FileReader();

        lector.onload = () => resolve(lector.result);
        lector.onerror = () => reject({ name: "LecturaFallida" });
        lector.readAsDataURL(blob);
      };

      this.grabador.stop();
    });
  }

  tomarFoto() {
    // Crear un elemento canvas para renderizr ahí la foto
    let canvas = document.createElement("canvas");

    // Colocar las dimensiones igual al elemento del video
    canvas.setAttribute("width", 300);
    canvas.setAttribute("height", 300);

    // obtener el contexto del canvas
    let context = canvas.getContext("2d"); // una simple imagen

    // dibujar, la imagen dentro del canvas
    context.drawImage(this.videoNode, 0, 0, canvas.width, canvas.height);

    this.foto = context.canvas.toDataURL();

    // limpieza
    canvas = null;
    context = null;

    return this.foto;
  }
}
