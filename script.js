document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("gl");
    const gl = canvas.getContext("webgl");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    alert(`Width: ${canvas.width}\nHeight: ${canvas.height}\nWarning: this will maxed out your GPU above its limits, Use this only if you have a high end gaming PC or a laptop!`);
    if (!gl) alert(`WebGL not supported`);

    const vertex = `
        attribute vec2 pos;
        void main() {
           gl_Position = vec4(pos, 0.0, 1.0);
        }
    `;

    const fragment = `
        precision highp float;
        uniform vec2 uRes;
        uniform vec2 uRot;
        uniform float uPower;

        float mandelbulb(vec3 p, float power) {
            vec3 z = p;
            float dr = 1.0;
            float r = 0.0;
            for (int i = 0; i < 100; i++) {
                 r = length(z);
                 if (r > 2.0) break;
                 float theta = acos(z.z / r);
                 float phi = atan(z.y, z.x);
                 dr = pow(r, power - 1.0) * power * dr + 1.0;
                 float zr = pow(r, power);
                 theta *= power;
                 phi *= power;
                 z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
                 z += p;
            }
            return 0.5 * log(r) * r / dr;
        }

        float raymarch(vec3 ro, vec3 rd, float power) {
            float t = 0.0;
            for (int i = 0; i < 100; i++) {
                 vec3 p = ro + rd * t;
                 float d = mandelbulb(p, power);
                 if (d < 0.001) return t;
                 t += d;
                 if (t > 10.0) break;
            }
            return t;
        }

        vec3 getNormal(vec3 p, float power) {
            float epsilon = 0.001;
            return normalize(vec3(
                mandelbulb(p + vec3(epsilon, 0, 0), power) - mandelbulb(p - vec3(epsilon, 0, 0), power),
                mandelbulb(p + vec3(0, epsilon, 0), power) - mandelbulb(p - vec3(0, epsilon, 0), power),
                mandelbulb(p + vec3(0, 0, epsilon), power) - mandelbulb(p - vec3(0, 0, epsilon), power)
            ));
        }

        float softShadow(vec3 ro, vec3 rd, float power) {
            float res = 1.0;
            float t = 0.02;
            for (int i = 0; i < 32; i++) {
                 float h = mandelbulb(ro + rd * t, power);
                 if (h < 0.001) return 0.0;
                 res = min(res, 8.0 * h / t);
                 t += h;
            }
            return clamp(res, 0.0, 1.0);
        }

        void main() {
            vec2 uv = (gl_FragCoord.xy - 0.5 * uRes.xy) / uRes.y;
            float a = uRot.x;
            float b = uRot.y;

            vec3 ro = vec3(4.0 * sin(a), 2.5 * sin(b), 4.0 * cos(a));
            vec3 ta = vec3(0.0);
            vec3 ww = normalize(ta - ro);
            vec3 uu = normalize(cross(vec3(0.0, 1.0, 0.0), ww));
            vec3 vv = cross(ww, uu);
            vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.5 * ww);

            float t = raymarch(ro, rd, uPower);
            vec3 col = vec3(0.0);

            if (t < 10.0) {
                vec3 p = ro + rd * t;
                vec3 n = getNormal(p, uPower);
                vec3 lightDir = normalize(vec3(0.8, 0.6, 0.4));
                float diff = max(dot(n, lightDir), 0.0);
                float shadow = softShadow(p + n * 0.01, lightDir, uPower);
                float amb = 0.2;
                float lighting = diff * shadow + amb;
                float hue = (n.x + n.y + n.z) * 1.8;
                col = lighting * vec3(sin(hue), sin(hue + 2.0944), sin(hue + 4.1888));
            }
            gl_FragColor = vec4(col, 1.0);
        }
    `;

    function compileShader(type, src) {
       const s = gl.createShader(type);
       gl.shaderSource(s, src);
       gl.compileShader(s);
       if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
           alert(gl.getShaderInfoLog(s));
       }
       return s;
    }

    const vs = compileShader(gl.VERTEX_SHADER, vertex);
    const fs = compileShader(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const VBO = new Float32Array([ -1, -1, 1, -1, -1, 1, 1, 1 ]);

    const pos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pos);
    gl.bufferData(gl.ARRAY_BUFFER, VBO, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uRot = gl.getUniformLocation(program, "uRot");
    const uPower = gl.getUniformLocation(program, "uPower");

    let rotX = 0.0;
    let rotY = 0.0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    function handleDown(e) {
       dragging = true;
       lastX = e.touches ? e.touches[0].clientX : e.clientX;
       lastY = e.touches ? e.touches[0].clientY : e.clientY;
    }

    function handleMove(e) {
       if (!dragging) return;
       const x = e.touches ? e.touches[0].clientX : e.clientX;
       const y = e.touches ? e.touches[0].clientY : e.clientY;
       rotX += (x - lastX) * 0.01;
       rotY += (y - lastY) * 0.01;
       lastX = x;
       lastY = y;
    }

    function handleUp() {
       dragging = false;
    }

    canvas.addEventListener("mousedown", handleDown);
    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseup", handleUp);
    canvas.addEventListener("touchstart", handleDown);
    canvas.addEventListener("touchmove", handleMove);
    canvas.addEventListener("touchend", handleUp);

    function loop() {
       if (!dragging) {
           rotX += 0.05;
       }
       gl.viewport(0, 0, canvas.width, canvas.height);
       gl.uniform2f(uRes, canvas.width, canvas.height);
       gl.uniform2f(uRot, rotX, rotY);
       gl.uniform1f(uPower, 8.0);
       gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
       requestAnimationFrame(loop);
    }

    loop();
});