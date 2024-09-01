// TODO: Reuse context
// clicking after fullscreenspam still wonky
var plotcontainer;
var plotanchor;
var errorout;
var plot;
var image;
var equation;
var compiled = "";
var glData;
var docScroll;
var rect;

var zoom = 0;
var offset = [0,0];

window.addEventListener("DOMContentLoaded", function(event) {
    plotcontainer = document.getElementsByClassName("plotcontainer")[0];
    plotanchor = document.getElementById("plotanchor");
    plot = document.getElementsByClassName("plot")[0];
    errorout = document.getElementById("errorout");
    equation = document.getElementById("equation");
    image = new Image();
    image.onload = plotJulia;
    image.src = "/resources/viridis.png";
    setupPlotControls();
});

document.addEventListener("fullscreenchange", function(event) {
    // https://developer.mozilla.org/en-US/docs/Web/API/Document/onfullscreenchange
    // "if Document.fullscreenElement is null, we're going out of fullscreen"
    if (document.fullscreenElement == null) {
        plotcontainer.classList.remove("fullscreen");
    } else {
        plotcontainer.classList.add("fullscreen");
    }
    // Remap the offset so it focuses on the same point, even if the canvas coordinates change.
    let ratioBefore = glData.context.drawingBufferWidth / glData.context.drawingBufferHeight;
    rect = plotcontainer.getBoundingClientRect();
    let ratioAfter = rect.width / (document.fullscreenElement == null ? rect.width : rect.height);
    let ratioRatio = ratioBefore / ratioAfter;
    // My formula stupidly works on [0,1] basis, not [-1,1].
    offset[0] = (offset[0] + 1)/2;
    offset[0] = offset[0] * ratioRatio - (ratioRatio - 1)/2;
    offset[0] = offset[0] * 2 - 1;
    plotJulia();
});

document.addEventListener("keydown", function(event) {
    // According to https://developer.mozilla.org/en-US/docs/Web/API/Document/keydown_event,
    // prevents IME-related stuff triggering it.
    if (event.isComposing || event.keyCode === 229)
        return;
    // Also ignore the keydown when we're focusing on an input
    if (event.target.tagName.toLowerCase() == "input")
        return;
    
    if (event.key.toLowerCase() === "f") {
        toggleFullscreen();
    }
});

function setupPlotControls() {
    let plotContent = document.getElementsByClassName("plotcontent")[0];
    plotContent.addEventListener("wheel", function(event) {
        event.preventDefault();
        // Set zoom. Across browsers the same scroll van give widely varying answers... so only looking at the sign.
        zoom += Math.sign(event.deltaY) / 3;
        // Also move towards zoom
        // rect = plot.getBoundingClientRect();
        // mousePos = [2*event.offsetX/rect.width - 1, 2*event.offsetY/rect.height - 1];
        // offset = [(offset[0] - mousePos[0] * Math.exp(zoom))/2, (offset[1] + mousePos[1] * Math.exp(zoom))/2];
        refreshOnlyViewport();
    }, {passive: false});
    plotContent.addEventListener("click", function(event) {
        let mousePos = [2*event.offsetX/rect.width - 1, 2*event.offsetY/rect.height - 1]; // 2* -1 instead of -0.5 to make it [-1,1]^2.
        offset[0] -= mousePos[0] * Math.exp(zoom);
        offset[1] += mousePos[1] * Math.exp(zoom);
        refreshOnlyViewport();
    });
    // dragging: look at some of the https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent, maybe https://developer.mozilla.org/en-US/docs/Web/API/Element/mousemove_event
}

function toggleFullscreen() {
    if (plotcontainer && plotcontainer.requestFullscreen) {
        if (document.fullscreenElement == null) {
            if (document.fullscreenElement == null && document.scrollingElement)
                docScroll = document.scrollingElement.scrollTop;
            plotcontainer.requestFullscreen();
        }
        else {
            document.exitFullscreen().then(function() {
                if (document.scrollingElement)
                    document.scrollingElement.scrollTop = docScroll;
            });
        }
        // note https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide "presentation differences"
    }
}

function setAndPlotJulia(expr) {
    equation.value = expr;
    if (window.innerWidth < 1051)
        plotcontainer.scrollIntoView({behavior: "smooth"});
    else
        plotanchor.scrollIntoView({behavior: "smooth"});
    resetViewAndPlotJulia();
}

function resetViewAndPlotJulia() {
    zoom = 0;
    offset = [0,0];
    plotJulia();
}

function plotJulia() {
    try {
        compiled = math2webgl(equation.value);
        console.log(compiled);
        errorout.innerHTML = "";
    } catch (e) {
        errorout.innerHTML = e;
        throw e;
        return;
    }

    if (document.fullscreenElement == null) {
        rect = plot.getBoundingClientRect();
        plot.width = rect.width;
        plot.height = rect.width; // not a typo, I want it square
    } else {
        rect = plotcontainer.getBoundingClientRect();
        plot.width = rect.width;
        plot.height = rect.height;
    }
    let gl = plot.getContext("webgl");
    if (gl == null) {
        alert("WebGL is needed to render these plots. Note to self: do something better than alert.");
        return;
    }
    gl.viewport(0, 0, plot.width, plot.height);

    var program = gl.createProgram();
    var texture = gl.createTexture();
    initGL(gl, vert, getFrag(), program, texture);
    // gl.clearColor(1,0,1,1);
    // gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    glData = { context: gl, prog: program };
    var error = gl.getError();
    if (error)
        errorout.innerHTML = `[GL Error] Error code ${error}`;
}

// Assumes plotJulia has been called before.
function refreshOnlyViewport() {
    let gl = glData.context;
    let program = glData.prog;
    
    gl.uniform1f(gl.getUniformLocation(program, "aspectRatio"), plot.width/plot.height);
    gl.uniform1f(gl.getUniformLocation(program, "zoom"), zoom);
    gl.uniform2fv(gl.getUniformLocation(program, "offset"), offset);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// A lot of this is due to https://medium.com/neosavvy-labs/webgl-1-introduction-to-shaders-b20fa62c7c4
// and https://webglfundamentals.org/webgl/lessons/webgl-2-textures.html
// I like both writing shaders and writing gpu pipeline stuff, but this kinda pipeline stuff...
// It's just easier to copypaste lmao

function initGL(gl, vertex, fragment, program, texture) {
    addShader(gl, program, gl.VERTEX_SHADER, vertex);
    addShader(gl, program, gl.FRAGMENT_SHADER, fragment);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Vertex position info
    var posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            -1.0,  1.0,
             1.0,  1.0,
            -1.0, -1.0,
             1.0, -1.0]),
        gl.STATIC_DRAW
    );

    let aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(gl.aPosition, 2, gl.FLOAT, false, 0, 0); // index, size, type, normalized, stride, offset

    // Texture position info
    var texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            0.0,  0.0,
            1.0,  0.0,
            0.0,  1.0,
            0.0,  1.0,
            1.0,  0.0,
            1.0,  1.0]),
        gl.STATIC_DRAW
    );

    let aTexcoord = gl.getAttribLocation(program, "aTexcoord");
    gl.enableVertexAttribArray(aTexcoord);
    gl.vertexAttribPointer(aTexcoord, 2, gl.FLOAT, false, 0, 0);

    // Textures themselves
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    
    let textureLocation = gl.getUniformLocation(program, "vSampler");
    gl.uniform1i(textureLocation, 0);

    // Other data
    gl.uniform1f(gl.getUniformLocation(program, "aspectRatio"), plot.width/plot.height);
    gl.uniform1f(gl.getUniformLocation(program, "zoom"), zoom);
    gl.uniform2fv(gl.getUniformLocation(program, "offset"), offset);
}

function addShader(gl, program, type, src) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log(`GL Error: \n\n${gl.getShaderInfoLog(shader)}`);
        return;
    }
    gl.attachShader(program, shader);
}

var vert = `
    attribute vec3 aPosition;
    attribute vec2 aTexcoord;
    
    varying vec3 vPosition;
    varying vec2 vTexcoord;

    void main() {
        gl_Position = vec4(aPosition, 1.);
        vPosition = aPosition;
        vTexcoord = aTexcoord;
    }
`

function getFrag() {
    return`
    precision mediump float;
    uniform sampler2D vSampler;
    uniform float aspectRatio;
    uniform float zoom;
    uniform vec2 offset;

    varying vec3 vPosition;
    varying vec2 vTexcoord;
    varying float vAspectRatio;

    // (Everything considers a vector (x,y) as x+iy)
    vec2 cMul(vec2 a, vec2 b) {
        return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
    }

    vec2 cDiv(vec2 a, vec2 b) {
        return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x*b.y) / (b.x * b.x + b.y * b.y);
    }

    vec2 cExp(vec2 z) {
        float r = exp(z.x);
        return vec2(r * cos(z.y), r * sin(z.y));
    }

    vec2 cLog(vec2 z) {
        return vec2(log(length(z)), atan(z.y, z.x));
    }

    vec2 cSqrt(vec2 z) {
        return cExp(cLog(z)/2.);
    }

    vec2 cPow(vec2 z, vec2 exp) {
        return cExp(cMul(cLog(z),exp));
    }

    vec2 cCos(vec2 z) {
        return (cExp(vec2(-z.y, z.x)) + cExp(vec2(z.y, -z.x)))/2.;
    }

    vec2 cSin(vec2 z) {
        return cDiv(cExp(vec2(-z.y, z.x)) - cExp(vec2(z.y, -z.x)), vec2(0., 2.));
    }

    vec2 cTan(vec2 z) {
        return cDiv(cSin(z),cCos(z));
    }

    vec2 cCosh(vec2 z) {
        return (cExp(z) + cExp(-z))/2.;
    }

    vec2 cSinh(vec2 z) {
        return (cExp(z) - cExp(-z))/2.;
    }

    vec2 cTanh(vec2 z) {
        return cDiv(cSinh(z),cCosh(z));
    }

    // https://en.wikipedia.org/wiki/Inverse_trigonometric_functions#Logarithmic_forms
    vec2 cAsin(vec2 z) {
        z = cSqrt(vec2(1.,0.) - cMul(z,z)) - vec2(z.y, -z.x);
        z = cLog(z);
        return vec2(-z.y, z.x);
    }

    vec2 cAcos(vec2 z) {
        vec2 z2 = cSqrt(vec2(1.,0.) - cMul(z,z));
        z += vec2(-z2.y, z2.x);
        z = cLog(z);
        return vec2(z.y, -z.x);
    }

    vec2 cAtan(vec2 z) {
        z = cDiv(vec2(1.-z.y,z.x), vec2(1.+z.y,-z.x));
        z = cLog(z)/2.;
        return vec2(z.y, -z.x);
    }

    // https://en.wikipedia.org/wiki/Inverse_hyperbolic_functions#Definitions_in_terms_of_logarithms
    vec2 cAcosh(vec2 z) {
        return cLog(z + cSqrt(cMul(z,z) - vec2(1.,0.)));
    }

    vec2 cAsinh(vec2 z) {
        return cLog(z + cSqrt(cMul(z,z) + vec2(1.,0.)));
    }

    vec2 cAtanh(vec2 z) {
        return cLog(cDiv(vec2(1.,0.)+z,vec2(1.,0.)-z))/2.;
    }

    void main() {
        float iters = 0.;
        vec2 z = vPosition.xy * exp(zoom) - offset;
        z.x *= aspectRatio;
        for (float i = 0.; i < 100.; i++) {
            z = ${compiled};
            iters += float(dot(z,z) < 9.);
        }
        float progress = log2(iters + 2.)/log2(102.);

        gl_FragColor = texture2D(vSampler, vec2(progress,0.5));
    }`
;};