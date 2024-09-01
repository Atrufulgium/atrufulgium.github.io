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
I apparently have a thing going on "new week, new programming language". Let's keep it up, and this week, move on to *shaders*.

I'll talk about the shader I made for [a music video](https://www.youtube.com/watch?v=8FtlRY6haUI) ages ago. It is a shader that renders the scene in a wireframe mesh. However, unlike most of those shaders, I make the lines look hand-drawn. The following mineshaft scene was rendered fully with this shader (though I edited the colours in post to fit this blog):

[sketch]
[![A scene, sketched with this shader.](/resources/images/sketch-shader/sample.png)][hover-sample.png]

[hover-sample.png]: ## "How many headaches do you think I went through implementing this?&#013;Place your bets, without looking at the scrollbar!"

[/sketch]

In this post, I'll introduce everything you need to do this yourself, from the ground up. Buckle up, this'll be a long ride. (People that are already familiar with shaders can skip ahead to the "How to sketch, intuitively" section.)

The code for this shader as used in the video can be found in my [pile-of-shaders](https://github.com/Atrufulgium/pile-of-shaders) repo. This code will differ a little, for presentation purposes.

Shader crash-course: pixels
===========================
Back before GPUs were a thing, and before "shader" was a scary word, drawing graphics was just something you did on the CPU like anything else. There was some block in memory where you wrote your frame data, which would be read by whatever was responsible for actually putting stuff on the screen.[^1]

In other words, if you wanted to render a single 3D sphere, your code would probably look something like this.
```csharp
for (int y = 0; y < WIDTH; y++) {
    for (int x = 0; x < HEIGHT; x++) {
        // Code that calculates the color of (x,y).
        
        // First determine whether this pixel is actually part of
        // your sphere. Then do some physics to color it properly.
    }
}
```
In this case, the only intimidating thing, really, would be the math for rendering a sphere. You wouldn't have to deal with the entire separate framework of "shaders" that seems to intimidate people.

However, this is pretty slow. Going pixel per pixel may be doable when you're rendering tens of thousands of pixels, but you wouldn't render the millions of pixels of today's screens like that. You're executing the same code for each pixel, and only the `x` and `y` variables are different. What if you had a device that could, say, do the same shading code on thousands of pixels at a time?

This is the task of the GPU. Compared to your CPU, it executes fewer instructions, and handles code with conditionals very poorly. But in exchange, we get the upside of massively parallelizing our execution.

```hlsl
color frag(float2 xy : TEXCOORD) : SV_Target {
    // Code that calculates the color of (x,y).
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

Consider our previous hard-coded sphere renderer. What if we wanted to add another sphere, and move the two around? Looping over all pixels quickly becomes awkward when you keep adding stuff to your scene.

The way GPUs solve this, is to work with *geometry*, first and foremost. The GPU accepts a list of triangles that represent various objects. In our case, the two spheres.

IMAGE

The GPU first lets you modify of these triangles' corners, the *vertices*, in the "vertex shader". Move them around, make them do a little dance, whatever. After that, the GPU executes the "fragment shader" for every triangle, for every pixel that lies on that triangle. Our code that renders these spheres will now look something like this. (I'm still not gonna include any math yet.)

```hlsl
fragment_input vert(vertex_input vertex) {
    // Do some math so that this triangle corner takes into account
    // perspective and perhaps some other stuff.
}

color frag(fragment_input fragment) : SV_Target {
    // Code that calculates the color of `fragment.xy`.
    // This is run for every triangle for every pixel inside that
    // triangle.
}
```

The GPU abstracts away quite a lot for us. If you wanted to do this on the CPU, you'd get a ton of loops.

```csharp
// Vertex calculations
foreach(var corner in triangle_corners) {
    // Do some math so that this triangle corner takes into account
    // perspective and perhaps some other stuff.
}

// Fragment calculations
foreach(var triangle in triangles) {
    foreach (var fragment in triangle) {
        // Code that calculates the color of `fragment.xy`.
    }
}
```

And not only are all of these loops implicit, the GPU also executes them in parallel! Truly a wonderful little piece of hardware, isn't it? This way, you can spend millions of triangles rendering thousands of teeth a player's never gonna see, or detail each individual bristle on a tiny toothbrush, with only a *small* performance penalty!

Various coordinate spaces
=========================
Okay, I want to avoid discussing mathematical concepts as much as I can in this post, but this is something I can't get around, as all coordinate spaces are actually relevant to my needs.

When you create 3D meshes in Blender or Maya or whatever, you (usually) create them near $(0,0,0)$. All triangles of your mesh are defined with respect to this coordinate space. But when you want to put your mesh in a scene a kilometre over, you don't move every single triangle over. That would take a lot of time. Instead, you separately store that you moved your mesh a kilometre over.

IMAGE

Then there's the camera rendering your scene. The math for doing camera things (such as projection) is *much* easier if the camera is at $(0,0,0)$. Finally, there's the space that actually represents your screen. The left of your screen is at $x = -1$, the right of your screen is at $x = 1$, all very predictable behaviour[^3].

IMAGE

This leads us to the following coordinate spaces.

- The *model space* puts the model at $(0,0,0)$. The three coordinates represent, respectively, "to the side", "upwards", and "forwards"[^4], compared to the model's orientation.
- *World space* has an arbitrary origin denoted as $(0,0,0)$. Models, cameras, light sources, everything is positioned relative to this origin. The y-coordinate represents "up", while the other two are the horizontal plane.
- *Camera space* puts the camera at $(0,0,0)$, pointing in the $-z$ direction.
- *Screen space* represents your screen as discussed above[^5].

Converting between these spaces requires a bunch of linear algebra, but we'll just be considering these transformations to be black boxes that we'll call `M`, `V`, and `P`.

- To go from model space to world space, we apply the *model matrix* `M`. You may also know this matrix as the *transform* of your object.
- To go from world space to camera space, we apply the *view matrix* `V`. This is the inverse of the camera's transform.
- To go from camera space to screen space, we apply the *projection matrix* `P`. This matrix depends on your camera's settings, and as its name suggests, also handles perspective projection.

IMAGE

A slightly more comprehensive explanation about these various coordinate spaces with a very helpful animation can be found [here](https://jsantell.com/model-view-projection/).

How to sketch, intuitively
==========================
Now, before we can get to code, we should know what we're doing. What is it that we're actually doing when we're sketching?

What I'm doing is quite simple really. For every triangle, I want to have a sketchy line on top of its three edges. To achieve this, we overlay a small rectangle (two triangles) over each of its edges.

IMAGE

Personally, I want my lines to be of consistent thickness throughout[^6]. Conceptually the easiest way to do this, is to draw the lines "on your screen". In other words, we'll need to generate our triangles in screen space.

However, this would also create diagonal lines for cuboids like pillars and rails.

IMAGE

I don't want these lines. The way we go about preventing them, is checking for right angles. We cannot check this in screen space however, as the perspective projection distorts angles.

IMAGE

So instead, we check for right angles in world space. (Model space and camera space would also work fine.) We can even give some margin to this check, so that very thin triangles don't give a ton of lines.

IMAGE

(TODO: Camera space clipping)

Geometry shaders
================

Creating lines
==============

Clipping lines
==============

Finishing touches
=================

Conclusion
==========

[/block]

[^1]: Of course, the history of graphics devices is much deeper than I make it seem here, and I'm wholly unqualified to talk about it anyways.
[^2]:
    I'm massively simplifying, of course. First of all, *fragments* and *pixels* are not the same, but conceptually, thinking of them as the same works for this post.

    On top of that, fragment shaders are only run for all pixels *that lie in some specific region*, and not simply every pixel on screen. Just keep reading on, I'll expand on this in the next section.

[^3]: I'm being facetious, why isn't it standardised yet what direction is "up", whether you're working in $[-1,1]^2$ or $[0,1]^2$, etc. etc. grumble, grumble. Sure, it's not difficult and only takes a few macros to deal with, but *let me rant about this*.
[^4]: For me, y is up. The only 3D things I've used extensively are Unity and Minecraft. I can't let z point upwards then, can I?
[^5]: I'm intentionally glossing over the difference between clip space and normalized device coordinates, as that's a difference I won't be needing here.
[^6]:
    This is a completely subjective choice. Doing this causes detailed meshes further away to become small coloured blobs instead, which I don't mind.
    
    However, to someone else, this may be unacceptable, in which case you'd need differing line thicknesses. Line thickness is a great way to differentiate objects (thick outlines, thin inner lines), convey depth (thick lines close by, thin lines far away), shading (shaded areas thicker lines), etc. I'm not an artist, though, and this is a programming blog, so I won't go into this further than this footnote.

    If you do want to use different line thicknesses, I'd still recommend doing this in screen space as I did with consistent thickness. The quads you generate should then be of different thickness, that's all.

{:/nomarkdown}