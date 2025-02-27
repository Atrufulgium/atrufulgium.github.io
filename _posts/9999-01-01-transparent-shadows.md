---
layout: post
title: Transparent shadows are hard
title-lower: transparent shadows are hard
title-tiny: transparent shadows
blurb: In 3D you have to choose between "bad performance ray-tracing" and "ugly hacks" to get transparent shadows. In 2D, the situation is a little better. Just a little.
tags: c# math pixelart shaders
usemathjax: true
---
{::nomarkdown}

[block]
I really like sandbox games. I've talked about [voxels](/2024/08/14/intransitive) [twice](/2024/08/21/simd-flood-fill) already, but I also like 2D tile-based sandboxes[^1].

In 2D settings, you *could* use a premade lighting engine, but that's really no fun. Instead, in this post, I'll go into how I render light and shadows in my own lighting pipeline. This includes sending geometry to the gpu and processing it in custom compute stages to determine light contribution.

One gimmick of my lighting engine is that I use the fact that we're in a lower dimension to support realtime transparent shadows. In Unity, you usually have to use quite some hacks to get even close to this in 3D, but in 2D, it's not all *that* bad.

In case you've never heard the word "shader" before, first of all, what are you doing here, and second of all, I have a *very* enthousiastic post that introduces the basics [here](/2024/11/16/sketchy-wireframe).

The most reasonable approach
============================
What we want to do is deceptively simple. If we have a light source, we want to check if each surface is illuminated or not.

IMAGE

To achieve this, we draw lines from the light source, and mark the first surface we intersect. This surface is then lit, while any further surfaces are in the shadow.

IMAGE

The way this is achieved in the "ordinary" 3D setting[^2], is to put a camera at the light's position, that sees exactly what this light can illuminate. This camera renders the depth of the nearest object into a *depth map*. Later down the line, we're rendering the objects themselves we can use these: we just do some math to figure out if from the light's perspective, this object is at the depth map value, or further away.

IMAGE

In 2D, things are only slightly different. In 3D, our depth map was a 2D image, but if we're doing lighting in 2D, this depth map only has to be a 1D image.

IMAGE

But otherwise, everything we're doing is exactly the same. This gives us the most obvious approach for a 2D rendering engine: just use the 3D engine, and make the light camera's resolution $\text{whatever} \times 1$ pixels.

But this is where I noticed I could be greedier with my feature-set.

Another approach
================
In 3D, our lightmaps have a resolution of $\text{whatever} \times \text{whatever}$ pixels, while in 2D, they are squished to be just one pixel tall. Compared to 3D, we have tons of space left to do *more* than just shadow rendering.

And this is where I started to consider transparent shadows[^3]. We could use a texture of $\text{whatever} \times N$ pixels, where for each "ray" we draw from the camera, we can store $N-1$ helper values. I decided to use it for transparency. As a picture is worth a thousand words, here was my plan.

IMAGE

As you can see, instead of conceptually "stopping" the ray at the first surface we encounter, we support (up to $N-1$) *transparent* surfaces. The final pixel is used to store the opaque depth, just as in the 3D case.

When we now calculate the light affecting an object, we multiply the light value by all transparent values between our depth, and the light source.

IMAGE

Note how light is commutative! If you first put white light through a yellow filter, and then a purple filter, you get the same result as putting white light through a purple filter, and then a yellow filter.

IMAGE

Order not being important will be crucial later.
[/block]

[^1]: Nuh-uh, I'm not telling you my Terraria or Core Keeper play time.
[^2]: I know it's 2025, but I cannot feasibly call path tracing "ordinary" yet, given the hardware requirements (that my laptop fails).
[^3]:
    This is where I started to consider transparent shadows, if I want to make it a nice little story. This entire thing started with me dreaming this scheme and implementing it when I woke up.

    (This happens surprisingly often.)

{:/nomarkdown}