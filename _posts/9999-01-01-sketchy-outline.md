---
layout: post
title: Sketchy outline shader
title-lower: sketchy outline shader
title-tiny: sketch shader
blurb: A pretty expensive shader that traces geometry with hand-drawn lines.
---
{::nomarkdown}

[block]
I apparently have a thing going on "new week, new programming language". Let's keep it up, and this week, move on to *shaders*.

I'll talk about the shader I made for [a music video](https://www.youtube.com/watch?v=8FtlRY6haUI) ages ago. It is a shader that renders the scene in a wireframe mesh. However, unlike most of those shaders, I make the lines look hand-drawn. The following scene was rendered fully with a shader (though I edited the colours in post to fit this blog):

[sketch]
[![A scene, sketched with this shader.](/resources/images/sketch-shader/sample.png)][hover-sample.png]

[hover-sample.png]: ## "How many headaches do you think I went through implementing this?&#013;Place your bets, without looking at the scrollbar!"

[/sketch]

In this post, I'll introduce everything you need to do this yourself, from the ground up. Buckle up, this'll be a long ride. (People that are already familiar with shaders can skip ahead to the "Geometry shaders" section.)

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
In this case, the only intimidating thing really, would be the math for rendering a sphere. You wouldn't have to deal with the entire separate framework of "shaders" that seems to intimidate people.

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
While GPUs are pretty good at the 2D stuff, that's not really their main focus. Consider our previous hard-coded sphere renderer. What if we wanted to add another sphere, and move the two around? Looping over all pixels quickly becomes awkward when you keep adding stuff to your scene.

The way GPUs solve this, is to work with *geometry* first. The GPU accepts a list of triangles that represent various objects. In our case, the two spheres.

IMAGE

The GPU first lets you modify of these triangles' corners, the *vertices*, in the "vertex shader". Move them around, make them do a little dance, whatever. After that, the GPU executes the "fragment shader" for every triangle, for every pixel that lies on the triangle. Our code that renders these spheres will now look something like this. (I'm still not gonna include any math yet.)

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

And not only are all of these loops implicit, the GPU also executes them in parallel! Truly a wonderful little piece of hardware, isn't it?

Various coordinate spaces
=========================

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

    On top of that, fragment shaders are only run for all pixels *that lie in some region*, not simply every pixel on screen. Just keep reading on, I'll expand on this in the next section.

{:/nomarkdown}