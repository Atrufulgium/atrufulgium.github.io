---
layout: post
title: Sketchy outline shader
title-lower: sketchy outline shader
title-tiny: sketch shader
blurb: A pretty expensive shader that traces geometry with hand-drawn lines.
usemathjax: true
---
{::nomarkdown}

[block]
I'm done being distracted, let's write a new post. I have a thing "most posts feature a new programming language" going on, so let's keep it up, and this week, move on to *hlsl*.

I'll talk about the shader I made for [a music video](https://www.youtube.com/watch?v=8FtlRY6haUI) ages ago. It is a shader that renders the scene with a wireframe mesh. However, unlike most of those shaders, I make the lines look hand-drawn. The following mineshaft scene was rendered fully with this shader (though I edited the colours in post to fit this blog):

[sketch]
[![A scene, sketched with this shader.](/resources/images/sketch-shader/sample.png)][hover-sample.png]

[hover-sample.png]: ## "How many headaches do you think I went through implementing this?&#013;Place your bets, without looking at the scrollbar!"

[/sketch]

In this post, I'll introduce everything you need to do this yourself, from the ground up. Buckle up, this'll be a long ride. (People that are already familiar with shaders can skip ahead to the "How to sketch, intuitively" section.)

The code for this shader as used in the video can be found in my [pile-of-shaders](https://github.com/Atrufulgium/pile-of-shaders) repo. The code here will differ a little, for presentation purposes.

Shader crash-course: pixels
===========================
Back before GPUs were a thing, and before "shader" was a scary word, drawing graphics was just something you did on the CPU like anything else. There was some block in memory where you wrote your frame data, which would be read by whatever was responsible for actually putting stuff on the screen.[^1]

In other words, if you wanted to render a single 3D sphere, your code would probably look something like this.
```csharp
for (int y = 0; y < WIDTH; y++) {
    for (int x = 0; x < HEIGHT; x++) {
        // CODE THAT CALCULATES THE COLOR OF (x,y).
        
        // First determine whether this pixel is actually part of
        // your sphere. Then do some physics to color it properly.
        return CalculateColor(x,y);
    }
}
```
In this case, the only intimidating thing, really, would be the math for rendering a sphere. You wouldn't have to deal with the entire separate framework of "shaders" that seems to intimidate people.

However, this is pretty slow. Going pixel per pixel may be doable when you're rendering tens of thousands of pixels, but you wouldn't render the millions of pixels of today's screens like that. You're executing the same code for each pixel, and only the `x` and `y` variables are different. What if you had a device that could, say, do the same shading code on thousands of pixels at a time?

This is the task of the GPU. Compared to your CPU, it executes fewer instructions per second, and handles code with conditionals very poorly. But in exchange, we get the upside of massively parallelizing our execution.

```hlsl
color frag(float2 xy : TEXCOORD) : SV_Target {
    // CODE THAT CALCULATES THE COLOR OF (x,y).
    // This is run for every pixel; the double for-loop above
    // is implicit now.
    
    // First determine whether this pixel is actually part of
    // your sphere. Then do some physics to color it properly.
    return calculate_color(xy);
}
```
This "fragment shader" is run for every pixel[^2], and sort-of at the same time. We don't need to worry about the manual double for-loop as we did in the CPU case any longer.

However, shaders don't *just* do pixels.

Shader crash-course: vertices
=============================
While GPUs are pretty good at the 2D stuff, that's not really their main focus. They really shine in 3D.

Consider our previous hard-coded sphere renderer. What if we wanted to add another sphere, and move the two around? The approach above quickly becomes awkward when you keep adding stuff to your scene.

The way GPUs solve this, is to work with *geometry*, first and foremost. The GPU accepts a list of triangles that represent various objects. In our case, the two spheres.

IMAGE

The GPU first lets you modify of these triangles' corners, the *vertices*, in the "vertex shader". Move them around, make them do a little dance, whatever. This is usually where the math happens that makes "cameras" a thing in engines. After that, the GPU executes the "fragment shader" for every triangle, for every pixel that lies on that triangle. Our code that renders these spheres will now look something like this. (I'm still not gonna include any math yet.)

```hlsl
fragment_input vert(vertex_input vertex) {
    // Do some math so that this triangle corner takes into account
    // perspective and perhaps some other stuff.
}

color frag(fragment_input fragment) : SV_Target {
    // CODE THAT CALCULATES THE COLOR OF `fragment.xy`.
    // This is run for every triangle for every pixel inside that
    // triangle, and returns the color on your screen.
}
```

The GPU abstracts away quite a lot for us. If you wanted to do this on the CPU, you'd get a ton of loops!

```csharp
// Vertex calculations
foreach(var vertex in triangle_corners) {
    // Do some math so that this triangle corner takes into account
    // perspective and perhaps some other stuff.
}

// Fragment calculations, using the modified triangle_corner positions
foreach(var triangle in triangles) {
    foreach (var fragment in triangle) {
        // CODE THAT CALCULATES THE COLOR OF `fragment.xy`.
    }
}
```

And not only are all of these loops implicit, the GPU also executes them in parallel! Truly a wonderful little piece of hardware, isn't it? This way, you can spend millions of triangles rendering thousands of teeth a player's never gonna see, or detail each individual bristle on a tiny toothbrush, and people might not even notice!

Various coordinate spaces
=========================
Okay, I want to avoid discussing mathematical concepts as much as I can in this post, but this is something I can't get around, as coordinate spaces are actually relevant to this post.

When you create 3D meshes in Blender or Maya or whatever, you (usually) create them near $(0,0,0)$. All triangles of your mesh are defined with respect to this origin. But when you want to put your mesh in a scene a kilometre over, you don't move every single triangle in your mesh over. You would have to change *every single vertex*, which would take a lot of time. Instead, you *separately* store that you moved your mesh a kilometre over.

IMAGE

Then there's the camera rendering your scene. The math for doing camera things (such as projection) is *much* easier if the camera is at $(0,0,0)$. This requires us to move *everything* in the scene over! Again, you don't store this in every triangle, or every object, for the same reason as before. You just store this in the camera.

IMAGE

Finally, there's the space that actually represents your screen. The left of your screen is at $x = -1$, the right of your screen is at $x = 1$, all very predictable behaviour[^3].

IMAGE

This leads us to the following coordinate spaces.

- The *object space* puts the model at $(0,0,0)$. The three coordinates represent, respectively, "to the side", "upwards", and "forwards"[^4], compared to the model's orientation.
- *World space* has an arbitrary origin denoted as $(0,0,0)$. Models, cameras, light sources, everything is positioned relative to this origin. The y-coordinate represents "up", while the other two are the horizontal plane.
- *Camera space* puts the camera at $(0,0,0)$, pointing in the $-z$ direction.
- *Screen space* represents your screen as discussed above[^5].

Converting between these spaces requires a bunch of linear algebra, but we'll just be considering these transformations to be black boxes that we'll call `M`, `V`, and `P`.

- To go from object space to world space, we apply the *model matrix* `M`. You may also know this matrix as the *transform* of your object.
- To go from world space to camera space, we apply the *view matrix* `V`. This is the inverse of the camera's transform.
- To go from camera space to screen space, we apply the *projection matrix* `P`. This matrix depends on your camera's settings, and as its name suggests, also handles perspective projection.

We won't have to worry about constructing these matrices, as Unity will just give them to us.

IMAGE

A slightly more comprehensive explanation about these various coordinate spaces, with a very helpful animation, can be found [here](https://jsantell.com/model-view-projection/).

How to sketch, intuitively
==========================
Now, before we can get to code, we should know what we're doing. What is it that we're actually doing when I say we're sketching?

What I'm doing is quite simple really. For every triangle, I want to have a sketchy line on top of its three edges. To achieve this, we overlay a small rectangle (two triangles) over each of its edges.

IMAGE

Personally, I want my lines to be of consistent thickness throughout[^6]. Conceptually the easiest way to do this, is to draw the lines "on your screen". In other words, we'll need to generate our triangles in screen space.

However, this would also create diagonal lines for cuboids like pillars and rails.

IMAGE

I don't want these lines, it's not as tidy. The way we go about preventing them, is checking for right angles. We cannot check this in screen space however, as the perspective projection distorts angles.

IMAGE

So instead, we check for right angles in world space. (Object space and camera space would also work fine. I just want to use all spaces for this post.) We can even give some margin to this check, so that very thin triangles don't give a ton of lines either. This makes for instance UV-spheres look a little nicer.

IMAGE

One thing I haven't mentioned so far, is an optimization the GPU does for us: *clipping*. Suppose we have a triangle that lies only partially inside of screen space. We don't want to spend effort rendering the pixels outside the screen, do we? Luckily, the GPU shrinks the triangle right into view.

IMAGE

Unfortunately -- and I don't know if this is hardware-dependent -- the triangles we will add *don't* get clipped automatically. We need to manually put in the effort to achieve the same effect. This is not so much a performance optimization (if you write a shader like this, you really can't claim to care), but a correctness optimization. You can get some really ugly lines from one side of the screen to another if you fail to take this into account.

IMAGE

Finally, we don't want to see occluded lines. If some object is covering some other object's lines, we don't want to see both. To solve this, we also render a shrunken-down version of the mesh, entirely the same colour as the background.

IMAGE

The "intuitive" explanation is quite long already, so putting this into code will be an adventure!

Occlusion
=========
Let's start with the last thing I discussed in the previous section, as it's the easiest. It's also a fun demonstration of how vertex shaders can do more than just transform into screen space.

Let's think about this "shrinkage". The easiest way to go about this is to shrink our mesh in object space, before our other calculations. To do this, we need something called the "normal" vector. This is a vector that points away from the surface of the mesh, which is provided to us.

IMAGE

This vector is always of length one. Shrinking/expanding a mesh can now be described as "move vertices along their normal direction".

IMAGE

So the code to shrink is very easy now. After this, we also need to go from object space to camera space, and then we have our vertex shader.

```hlsl
float4 vert (
    float4 model_space : POSITION,
    float3 normal : NORMAL
) : SV_POSITION {
    // Shrink the mesh along the normals
    model_space.xy -= 0.1 * normal;

    // Now convert our updated model to screen space.
    // (Yes Unity provides combined MVP-matrices, but I'll be putting
    //  stuff between the passes, so I'm separating them beforehand.)
    world_space = mul(UNITY_MATRIX_M, model_space);
    camera_space = mul(UNITY_MATRIX_V, world_space);
    return mul(UNITY_MATRIX_P, camera_space);
}
```

We want to render every pixel the same colour. This gives us a very easy fragment shader.

```hlsl
float4 frag () : SV_Target {
    return float4(_InnerColor.rgb, 1);
}
```

The variable `_InnerColor` is the colour the end-user (me) set in the Unity editor, and should be the same as the background colour. Fortunately, there's absolute no complex logic whatsoever to just rendering a solid colour!

Geometry shaders
================
(Un?)fortunately, now we get to the interesting and more difficult part. Vertex and fragment shaders are not sufficient for overlaying triangles as discussed above. For this, we require a new kind of shader: the *geometry shader*.

The geometry shader is a shader that lives between the vertex and fragment shader steps, and as its name suggests, it's used to modify geometry. You can use them to add or remove whatever you want!

However, in general, geometry shaders are kind of bad[^7], and if you really need more triangles, you'd best use tessellation shaders. However, the triangles I'm adding simply don't mesh well with tessellation, so I don't really have a choice[^8].

In pseudocode, you can think of geometry shaders as follows:

```csharp
List<Triangle> newGeometry;
foreach (var triangle in triangles) {
    // Calculate new triangles based on this triangle.
    // Then add these triangles into the `newGeometry` list.
}
```

In hlsl, these shaders have some pretty extensive and weird syntax.

```hlsl
// Every triangle we processes results in at most 12 new corners.
[maxvertexcount(12)]
void geom(
    triangle vertex_output IN[3],
    inout TriangleStream<fragment_input> triStream
) {
    // We get the three corners the vertex shader gave us in `IN`.
    // We can add new geometry by appending triangle strips:
    triStream.append(v1);
    triStream.append(v2);
    triStream.append(v3);
    ...
    triStream.append(vN);
    triStream.RestartStrip();
}
```
Triangle strips are a neat way to represent geometry more efficiently. After you specify your first triangle, each triangle afterwards is specified by just one point, which connects to the last two points in the strip. This reduces a lot of duplication!

ANIMATION

Once we've decided we want to start somewhere else, we need to restart the strip.

Creating lines
==============
In our case, we will be creating three quads. A quad is simply a triangle strip with an extra vertex.

IMAGE

We'll be needing three quads that don't connect neatly to each other (they even overlap!). As such, we'll be generating three triangle strips per triangle.

Clipping lines
==============

Finishing touches
=================

I must emphasise, the performance is tragic
===========================================

Conclusion
==========

[/block]

[^1]: Of course, the history of graphics devices is much deeper than I make it seem here, and I'm wholly unqualified to talk about it anyways.
[^2]: Please don't yell at me graphics people. I *know* this is a ridiculous oversimplification. The slightly-less-ridiculous oversimplification comes a little later.
[^3]: I'm being facetious, it usually isn't at all what direction is "up", whether you're working in $[-1,1]^2$ or $[0,1]^2$, etc. etc. grumble, grumble. Sure, it's not difficult and only takes a few macros to deal with, but *let me rant about this*. It's an absolutely unnecessary extra layer of not-even-complexity, just annoyance.
[^4]: For me, y is up. The only 3D things I've used extensively are Unity and Minecraft. I can't reasonably have z point upwards then, can I?
[^5]: I'm intentionally glossing over the difference between clip space and normalized device coordinates and everything that comes with that, as that's a distinction I don't want to discuss here.
[^6]:
    This is a completely subjective choice. Doing this causes detailed meshes further away to become small coloured blobs instead, which I don't mind.
    
    However, to someone else, this may be unacceptable, in which case you'd need differing line thicknesses. Line thickness is a great way to highlight objects (thick outlines, thin inner lines), convey depth (thick lines close by, thin lines far away), shading (thicker lines in shaded areas), etc. I'm not an artist, though, and this is a programming blog, so I won't go into this further than this footnote.

    If you do want to use different line thicknesses, I'd still recommend doing this in screen space as I did with consistent thickness. The quads you generate should then be of different thickness, that's all. The information you need for this (mostly normals and depth) lie at your fingertips, so that shouldn't pose very many issues.

[^7]:
    See [this](https://gamedev.stackexchange.com/q/187584) stackexchange post for some discussion that also links to further reading.

    There is also [this](http://www.joshbarczak.com/blog/?p=667) in-depth older post (from 2015) that I have been taking as gospel. I don't know how much of it still applies, but the following part is pretty troublesome:
    > The API requires that the output of a geometry shader be rendered in input order. The fixed-function hardware on the other side is required to consume geometry shader outputs serially. This creates a sync point.

    Even if you know very little about GPUs at all, hearing the words "sync point" when working with millions of triangles, some red flags ought to be raised!

[^8]:
    Tessellation shaders don't work as well for the *intuitive* approach. I haven't tried it, but they may very well work still. The idea is as follows: we tessellate our triangle so that we get one new inner triangle, and a bunch of outer triangles. This inner triangle will grow to encompass a large region, while the outer triangles will just be rendered invisibly. This requires "clever" (hacky) usage of the barycentric coordinates your tesselation shader gets.

    IMAGE

    This *still* has quite a bit of overdraw and introduced triangles, but at least these triangles were generated by tessellation, instead of geometry shaders, which is not as terrible.

    Nevertheless, as I've emphasised countless of times, this is really not a shader you'd want to run in any context in which performance matters. That's why I haven't implemented this theoretically better version -- I simply don't care about doing it like this. The geometry approach is just much more intuitive.

    (Well, intuitive enough to write a post over half an hour long about, but...)

{:/nomarkdown}