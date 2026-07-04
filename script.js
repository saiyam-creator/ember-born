/* ============================================================
   EMBERBORN — cinematic engine
   Scroll position -> frame index -> canvas render, plus
   ambient ember particles, film grain, parallax, reveals,
   glitch effects and a custom cursor.
   ============================================================ */
(function(){
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  /* ---------------------------------------------------------
     FRAME SEQUENCE PRELOAD
  --------------------------------------------------------- */
  var FRAME_COUNT = 118;
  var FRAME_PATH = function(i){
    var n = String(i).padStart(3,"0");
    return "frames/frame_" + n + ".webp?v=4";
  };

  var frames = [];
  var loadedCount = 0;

  var preloader   = document.getElementById("preloader");
  var preFill     = document.getElementById("preFill");
  var prePct      = document.getElementById("prePct");
  var hudFrame    = document.getElementById("hudFrame");

  function updatePreloader(){
    var pct = Math.round((loadedCount / FRAME_COUNT) * 100);
    preFill.style.width = pct + "%";
    prePct.textContent = pct;
  }

  function preloadFrames(onDone){
    for (var i = 1; i <= FRAME_COUNT; i++){
      (function(idx){
        var img = new Image();
        img.onload = img.onerror = function(){
          loadedCount++;
          updatePreloader();
          if (loadedCount === FRAME_COUNT) onDone();
        };
        img.src = FRAME_PATH(idx);
        frames[idx-1] = img;
      })(i);
    }
  }

  /* ---------------------------------------------------------
     HERO CANVAS — scroll scrubbed frame sequence
  --------------------------------------------------------- */
  var canvas = document.getElementById("frameCanvas");
  var ctx = canvas.getContext("2d");
  var heroWrap = document.getElementById("hero-wrap");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  var targetFrameFloat = 0;
  var currentFrameFloat = 0;
  var lastDrawnIndex = -1;

  function resizeCanvas(){
    canvas.width  = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }

  function drawFrame(index){
    var img = frames[index];
    if (!img || !img.complete || img.naturalWidth === 0) return;
    var cw = canvas.width, ch = canvas.height;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var scale = Math.max(cw / iw, ch / ih);
    var dw = iw * scale, dh = ih * scale;
    var dx = (cw - dw) / 2, dy = (ch - dh) / 2;
    ctx.clearRect(0,0,cw,ch);
    ctx.drawImage(img, dx, dy, dw, dh);
    lastDrawnIndex = index;
    if (hudFrame) hudFrame.textContent = "FRAME " + String(index+1).padStart(3,"0") + " / " + FRAME_COUNT;
  }

  function computeHeroProgress(){
    var rect = heroWrap.getBoundingClientRect();
    var total = heroWrap.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    var scrolled = -rect.top;
    var p = scrolled / total;
    return Math.max(0, Math.min(1, p));
  }

  var scrollVelocity = 0;
  var lastProgress = 0;

  function tick(){
    var p = computeHeroProgress();
    scrollVelocity = Math.abs(p - lastProgress);
    lastProgress = p;

    targetFrameFloat = p * (FRAME_COUNT - 1);
    var lerpSpeed = reduceMotion ? 1 : 0.16;
    currentFrameFloat += (targetFrameFloat - currentFrameFloat) * lerpSpeed;

    var idx = Math.round(currentFrameFloat);
    idx = Math.max(0, Math.min(FRAME_COUNT - 1, idx));
    if (idx !== lastDrawnIndex) drawFrame(idx);

    updateBeats(p);
    if(window.updateMemorySequence){
  window.updateMemorySequence(p);
}
    updateGlobalProgress();
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------
     GLOBAL SCROLL PROGRESS RAIL + BACK TO TOP
  --------------------------------------------------------- */
  var progressFill = document.getElementById("progressFill");
  var backTop = document.getElementById("backTop");
  function updateGlobalProgress(){
    var doc = document.documentElement;
    var total = doc.scrollHeight - window.innerHeight;
    var p = total > 0 ? (window.scrollY / total) : 0;
    if (progressFill) progressFill.style.height = (p*100) + "%";
    if (backTop){
      if (window.scrollY > window.innerHeight * 1.2) backTop.classList.add("visible");
      else backTop.classList.remove("visible");
    }
  }

  /* ---------------------------------------------------------
     HERO TITLE — single intro beat, fades in then out early
  --------------------------------------------------------- */
  var beatEls = [];
  var INTRO_IN_END   = 0.10;
  var INTRO_HOLD_END = 0.20;
  var INTRO_OUT_END  = 0.32;
  var introGlitchFired = false;
  var nextUpEl = document.getElementById("nextUp");
  var NEXTUP_IN_START = 0.80;
  var NEXTUP_IN_END   = 0.98;

  function initHeroCopyReveal(){
    beatEls = Array.prototype.slice.call(document.querySelectorAll("#heroCopy .beat"));
  }

  function updateBeats(p){
    var op;
    if (p < INTRO_IN_END){
      op = clamp01(p / INTRO_IN_END);
    } else if (p < INTRO_HOLD_END){
      op = 1;
    } else if (p < INTRO_OUT_END){
      op = clamp01(1 - (p - INTRO_HOLD_END) / (INTRO_OUT_END - INTRO_HOLD_END));
    } else {
      op = 0;
    }
    for (var i = 0; i < beatEls.length; i++){
      var el = beatEls[i];
      el.style.opacity = op;
      el.style.transform = "translateY(" + ((1 - op) * 16) + "px)";
    }
    if (op > 0.85 && !introGlitchFired){
      introGlitchFired = true;
      triggerGlitch(document.querySelector(".hero-title.glitch-text"));
    }
    if (op < 0.05) introGlitchFired = false;

    if (nextUpEl){
      var nu = clamp01((p - NEXTUP_IN_START) / (NEXTUP_IN_END - NEXTUP_IN_START));
      nextUpEl.style.opacity = nu;
      nextUpEl.style.transform = "translateY(" + ((1 - nu) * 28) + "px)";
    }
  }

  /* ---------------------------------------------------------
     GLITCH TRIGGER HELPERS
  --------------------------------------------------------- */
  function triggerGlitch(el){
    if (!el || reduceMotion) return;
    el.classList.remove("is-glitching");
    void el.offsetWidth;
    el.classList.add("is-glitching");
    setTimeout(function(){ el.classList.remove("is-glitching"); }, 400);
  }

  function triggerScreenGlitch(){
    if (reduceMotion) return;
    var flash = document.getElementById("glitchFlash");
    flash.classList.remove("active");
    void flash.offsetWidth;
    flash.classList.add("active");
    setTimeout(function(){ flash.classList.remove("active"); }, 400);
  }

  function initGlitchOnEnter(){
    var els = document.querySelectorAll(".glitch-text");
    els.forEach(function(el){
      ScrollTrigger.create({
        trigger: el,
        start: "top 80%",
        onEnter: function(){ triggerGlitch(el); },
        once: true
      });
    });

    // occasional screen-wide glitch when crossing into key sections
    ["#data", "#gallery", ".quote-section"].forEach(function(sel){
      var target = document.querySelector(sel);
      if (!target) return;
      ScrollTrigger.create({
        trigger: target,
        start: "top 60%",
        onEnter: triggerScreenGlitch,
        once: true
      });
    });
  }

  /* ---------------------------------------------------------
     SECTION / GENERIC FADE-UP REVEALS
  --------------------------------------------------------- */
  function initSectionReveals(){
    gsap.utils.toArray(".section-head, .glass-panel, .stat-card, .counter-item, .gallery-item").forEach(function(el){
      gsap.fromTo(el, {opacity:0, y:36}, {
        opacity:1, y:0, duration:1.1, ease:"power3.out",
        scrollTrigger:{ trigger:el, start:"top 88%" }
      });
    });

    gsap.utils.toArray(".story-line").forEach(function(el, i){
      gsap.to(el, {
        opacity:1, y:0, duration:1, ease:"power3.out", delay:i*0.12,
        scrollTrigger:{ trigger:el, start:"top 88%" }
      });
    });

    gsap.utils.toArray(".mani-line").forEach(function(el, i){
      gsap.to(el, {
        opacity:1, y:0, duration:1, ease:"power3.out", delay:i*0.1,
        scrollTrigger:{ trigger:".manifesto-lines", start:"top 75%" }
      });
    });
    gsap.to(".manifesto-meta", {
      opacity:1, duration:1, delay:0.6,
      scrollTrigger:{ trigger:".manifesto-lines", start:"top 75%" }
    });

    gsap.fromTo(".quote-text", {opacity:0, y:24}, {
      opacity:1, y:0, duration:1.3, ease:"power3.out",
      scrollTrigger:{ trigger:".quote-section", start:"top 65%" }
    });
  }

  /* ---------------------------------------------------------
     GLASS PANEL / STAT CARD 3D TILT
  --------------------------------------------------------- */
  function initTilt(){
    var panels = document.querySelectorAll("[data-tilt]");
    panels.forEach(function(panel){
      panel.addEventListener("mousemove", function(e){
        var r = panel.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(panel, {
          rotateY: x * 8, rotateX: -y * 8, transformPerspective:600,
          duration:0.5, ease:"power2.out"
        });
      });
      panel.addEventListener("mouseleave", function(){
        gsap.to(panel, {rotateY:0, rotateX:0, duration:0.7, ease:"power3.out"});
      });
    });
  }

  /* ---------------------------------------------------------
     PARALLAX LAYERS (story section)
  --------------------------------------------------------- */
  function initParallax(){
    gsap.utils.toArray("[data-parallax]").forEach(function(el){
      var speed = parseFloat(el.getAttribute("data-parallax")) || 0.2;
      gsap.to(el, {
        yPercent: speed * 40,
        ease:"none",
        scrollTrigger:{
          trigger: el.closest(".story-section"),
          start:"top bottom",
          end:"bottom top",
          scrub:true
        }
      });
    });
  }

  /* ---------------------------------------------------------
     POWER METER FILL (energy section)
  --------------------------------------------------------- */
  function initPowerMeter(){
    var fills = document.querySelectorAll(".power-fill");
    ScrollTrigger.create({
      trigger:".energy-section",
      start:"top 60%",
      once:true,
      onEnter:function(){
        fills.forEach(function(f){ f.style.width = f.getAttribute("data-target") + "%"; });
      }
    });
  }

  /* ---------------------------------------------------------
     STAT RINGS + NUMBER COUNTERS (data section)
  --------------------------------------------------------- */
  function animateCount(el, target, duration){
    var start = 0;
    var startTime = null;
    function step(ts){
      if (!startTime) startTime = ts;
      var progress = Math.min(1, (ts - startTime) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }

  function initDataSection(){
    var circumference = 2 * Math.PI * 52;

    ScrollTrigger.create({
      trigger: "#data",
      start: "top 55%",
      once: true,
      onEnter: function(){
        document.querySelectorAll(".ring-fill").forEach(function(ring){
          var pct = parseFloat(ring.getAttribute("data-pct")) || 0;
          var offset = circumference * (1 - pct/100);
          ring.style.strokeDasharray = circumference;
          ring.style.strokeDashoffset = circumference;
          requestAnimationFrame(function(){ ring.style.strokeDashoffset = offset; });
        });
        document.querySelectorAll(".ring-label, .counter-num").forEach(function(el){
          var target = parseInt(el.getAttribute("data-count"), 10) || 0;
          animateCount(el, target, 1600);
        });
      }
    });
  }

  /* ---------------------------------------------------------
     AMBIENT EMBER PARTICLES
  --------------------------------------------------------- */
  function initEmbers(){
    var c = document.getElementById("emberCanvas");
    var ec = c.getContext("2d");
    var particles = [];
    var MAX = reduceMotion ? 20 : 70;

    function resize(){ c.width = window.innerWidth; c.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);

    function spawn(n){
      for (var i=0;i<n;i++){
        if (particles.length >= MAX) return;
        particles.push({
          x: Math.random()*c.width,
          y: c.height + 10,
          r: 0.6 + Math.random()*2.2,
          vy: 0.3 + Math.random()*0.9,
          vx: (Math.random()-0.5)*0.4,
          life: 0,
          maxLife: 260 + Math.random()*260,
          hue: Math.random() > 0.5 ? "255,90,41" : "232,163,92",
          drift: Math.random()*Math.PI*2
        });
      }
    }

    function step(){
      var intensity = Math.min(1, scrollVelocity * 40);
      if (Math.random() < 0.06 + intensity*0.4) spawn(1 + Math.round(intensity*2));

      ec.clearRect(0,0,c.width,c.height);
      for (var i = particles.length-1; i>=0; i--){
        var p = particles[i];
        p.life++;
        p.drift += 0.02;
        p.x += p.vx + Math.sin(p.drift)*0.3;
        p.y -= p.vy;
        var lifeRatio = p.life / p.maxLife;
        var alpha = lifeRatio < 0.15 ? lifeRatio/0.15 : (1 - (lifeRatio-0.15)/0.85);
        alpha = Math.max(0, Math.min(1, alpha)) * 0.75;

        ec.beginPath();
        ec.fillStyle = "rgba(" + p.hue + "," + alpha + ")";
        ec.shadowColor = "rgba(" + p.hue + ",0.9)";
        ec.shadowBlur = 8;
        ec.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ec.fill();

        if (p.life > p.maxLife || p.y < -20) particles.splice(i,1);
      }
      requestAnimationFrame(step);
    }
    step();
  }

  /* ---------------------------------------------------------
     FILM GRAIN OVERLAY
  --------------------------------------------------------- */
  function initGrain(){
    var c = document.getElementById("grainCanvas");
    var gctx = c.getContext("2d");
    var w = 140, h = 140;
    c.width = w; c.height = h;
    c.style.width = "100%"; c.style.height = "100%";

    function renderNoise(){
      var imgData = gctx.createImageData(w,h);
      var buf = imgData.data;
      for (var i=0;i<buf.length;i+=4){
        var v = Math.random()*255;
        buf[i] = buf[i+1] = buf[i+2] = v;
        buf[i+3] = 255;
      }
      gctx.putImageData(imgData,0,0);
    }
    renderNoise();
    if (!reduceMotion) setInterval(renderNoise, 90);
  }

  /* ---------------------------------------------------------
     ENERGY SECTION — waveform canvas
  --------------------------------------------------------- */
  function initWaveform(){
    var c = document.getElementById("waveCanvas");
    var wctx = c.getContext("2d");
    function resize(){ c.width = c.offsetWidth; c.height = c.offsetHeight; }
    resize();
    window.addEventListener("resize", resize);

    var t = 0;
    function draw(){
      t += 0.02;
      wctx.clearRect(0,0,c.width,c.height);
      var bars = 64;
      var gap = c.width / bars;
      for (var i=0;i<bars;i++){
        var n = Math.sin(i*0.35 + t) * 0.5 + Math.sin(i*0.12 - t*1.4) * 0.5;
        var amp = (n*0.5+0.5) * c.height * 0.35 + 6;
        var x = i*gap;
        var grad = wctx.createLinearGradient(0, c.height/2-amp, 0, c.height/2+amp);
        grad.addColorStop(0, "rgba(255,90,41,0.05)");
        grad.addColorStop(0.5, "rgba(255,90,41,0.5)");
        grad.addColorStop(1, "rgba(255,90,41,0.05)");
        wctx.fillStyle = grad;
        wctx.fillRect(x, c.height/2 - amp, gap*0.5, amp*2);
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ---------------------------------------------------------
     AWAKENING — climax burst canvas
  --------------------------------------------------------- */
  function initBurst(){
    var c = document.getElementById("burstCanvas");
    var bctx = c.getContext("2d");
    var particles = [];
    var fired = false;

    function resize(){ c.width = c.offsetWidth; c.height = c.offsetHeight; }
    resize();
    window.addEventListener("resize", resize);

    function fireBurst(){
      var cx = c.width/2, cy = c.height*0.55;
      for (var i=0;i<140;i++){
        var angle = Math.random()*Math.PI*2;
        var speed = 1 + Math.random()*5;
        particles.push({
          x:cx, y:cy,
          vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
          r: 0.8 + Math.random()*2.4, life:0, maxLife: 80+Math.random()*80,
          hue: Math.random()>0.4 ? "255,90,41" : "232,163,92"
        });
      }
    }

    ScrollTrigger.create({
      trigger:".awakening-section",
      start:"top 60%",
      once:true,
      onEnter:function(){ if(!fired){ fired = true; fireBurst(); triggerScreenGlitch(); } }
    });

    function step(){
      bctx.clearRect(0,0,c.width,c.height);
      for (var i=particles.length-1;i>=0;i--){
        var p = particles[i];
        p.life++;
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.98; p.vy *= 0.98;
        var a = Math.max(0, 1 - p.life/p.maxLife);
        bctx.beginPath();
        bctx.fillStyle = "rgba("+p.hue+","+a+")";
        bctx.shadowColor = "rgba("+p.hue+",0.9)";
        bctx.shadowBlur = 10;
        bctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        bctx.fill();
        if (p.life > p.maxLife) particles.splice(i,1);
      }
      requestAnimationFrame(step);
    }
    step();

    document.getElementById("replayBtn").addEventListener("click", function(){
      fired = false;
      window.scrollTo({top:0, behavior: reduceMotion ? "auto" : "smooth"});
    });
  }

  /* ---------------------------------------------------------
     CUSTOM CURSOR
  --------------------------------------------------------- */
  function initCursor(){
    if (!window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
    var dot = document.getElementById("cursorDot");
    var ring = document.getElementById("cursorRing");
    var mx=0, my=0, rx=0, ry=0;

    window.addEventListener("mousemove", function(e){
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + "px"; dot.style.top = my + "px";
    });

    function loop(){
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.left = rx + "px"; ring.style.top = ry + "px";
      requestAnimationFrame(loop);
    }
    loop();

    document.querySelectorAll("[data-cursor-hover], a, button").forEach(function(el){
      el.addEventListener("mouseenter", function(){ ring.classList.add("hover"); });
      el.addEventListener("mouseleave", function(){ ring.classList.remove("hover"); });
    });

    document.addEventListener("mouseleave", function(){
      dot.classList.add("hidden"); ring.classList.add("hidden");
    });
    document.addEventListener("mouseenter", function(){
      dot.classList.remove("hidden"); ring.classList.remove("hidden");
    });
  }

  /* ---------------------------------------------------------
     SMOOTH ANCHOR SCROLL FOR NAV LINKS
  --------------------------------------------------------- */
  function initNavScroll(){
    document.querySelectorAll('#siteNav a[href^="#"]').forEach(function(a){
      a.addEventListener("click", function(e){
        var id = a.getAttribute("href");
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        window.scrollTo({ top: target.offsetTop - 40, behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  }

  /* ---------------------------------------------------------
     BOOT
  --------------------------------------------------------- */
  function boot(){
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    initHeroCopyReveal();
    initSectionReveals();
    initTilt();
    initParallax();
    initPowerMeter();
    initDataSection();
    initGlitchOnEnter();
    initEmbers();
    initGrain();
    initWaveform();
    initBurst();
    initCursor();
    initNavScroll();

    drawFrame(0);
    requestAnimationFrame(tick);

    preloader.classList.add("done");
    setTimeout(function(){ ScrollTrigger.refresh(); }, 300);
  }

  updatePreloader();
  preloadFrames(boot);

})();

function initMemorySequence(){

  const lines = document.querySelectorAll(".memory-line");
  const symbol = document.querySelector(".memory-symbol");

  function updateMemory(progress){

    lines.forEach(line => line.classList.remove("active"));

    if(progress > 0.22 && progress < 0.34){
      lines[0].classList.add("active");
    }

    if(progress > 0.34 && progress < 0.48){
      lines[1].classList.add("active");
    }

    if(progress > 0.48 && progress < 0.62){
      lines[2].classList.add("active");
      symbol.classList.add("active");
    } else {
      symbol.classList.remove("active");
    }

    if(progress > 0.62 && progress < 0.78){
      lines[3].classList.add("active");
    }
  }

  window.updateMemorySequence = updateMemory;
}

initMemorySequence();
