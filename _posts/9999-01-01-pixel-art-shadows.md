---
layout: post
title: Pixel art shadows
title-lower: pixel art shadows
title-tiny: pixel art shadows
blurb: >
    A stylisation that's kinda rare -- make shadows follow the pixels of your texture. It's rare for a reason: it's an pain to implement.
tags: pixelart shaders voxels
---
{::nomarkdown}

[block]
I have a kind of controversial Minecraft opinion. I don't like "Smooth Lighting".

*Audience gasps.*

SCREENSHOT  
*Textures courtesy of [Fulmine](https://modrinth.com/resourcepack/spectral). Give him some ad revenue!*

When it's off, lighting doesn't interfere with the pixel aesthetic of the game. Every block face has a single light level and that's it. On the other hand, smooth lighting, as the name suggests, smooths the lighting out over the block faces. This ignores the pixel art aesthetic of the game, so I don't like it! (TODO: AO COMMENT?)

Like every good(?) programmer, I have a voxel engine I'm working on. So when it comes to lighting, the choice is simple: *don't* do what Minecraft does for smooth lighting! Instead, I want the lighting to respect the pixels of the texture.

SCREENSHOT  
*Textures still courtesy of [Fulmine](https://modrinth.com/resourcepack/spectral). Have you given him his ad revenue yet?*

In this post, I'll go into Unity's built-in render pipeline, and how to hack around in there to get these pixelated shadows.

While Unity's shaders can be found in [the Unity download archive](https://unity.com/releases/editor/archive), I'll refer to a mirrored repo instead, so that I can link specific files.

Forward rendering
=================

There's generally two ways to render geometry in a traditional render pipeline: forward, and deferred. Oversimplifying, a forward renderer just renders objects completely. When rendering an object, it takes into account all of its properties -- colour, shine, roughness, etc. -- to compute how this object is affected by light immediately.

IMAGE

Deferred rendering, on the other hand, renders the result of each property individually. This results in separate "colour", "shine", "roughness" textures. Afterwards, light is rendered as a screen space post-processing step, taking all of these textures into account.

IMAGE

Unity allows you to use both methods, however, I'll just be focusing on the built-in forward shaders. The [standard shader](https://github.com/TwoTailsGames/Unity-Built-in-Shaders/blob/master/DefaultResourcesExtra/Standard.shader) defines a ton of properties and shader passes, but a few things are worth highlighting.

```shaderlab
//  Base forward pass (directional light, emission, lightmaps, ...)
Pass
{
    Name "FORWARD"
    Tags { "LightMode" = "ForwardBase" }
    ...
    #pragma vertex vertBase
    #pragma fragment fragBase
    #include "UnityStandardCoreForward.cginc"
}

//  Additive forward pass (one light per pass)
Pass
{
    Name "FORWARD_DELTA"
    Tags { "LightMode" = "ForwardAdd" }
    ...
    #pragma vertex vertAdd
    #pragma fragment fragAdd
    #include "UnityStandardCoreForward.cginc"
}

//  Shadow rendering pass
Pass {
    Name "SHADOWCASTER"
    Tags { "LightMode" = "ShadowCaster" }
    ...
    #pragma vertex vertShadowCaster
    #pragma fragment fragShadowCaster
    #include "UnityStandardShadow.cginc"
}
```

When rendering an object, Unity assumes you have a directional light (a "sun") somewhere in your scene, which illuminates your object. The `FORWARD` pass uses this light's direction to see what parts are lit, and what parts aren't.

IMAGE

However, when you add more stuff into your scene, you might notice something is off: objects don't cast shadows onto each other.

IMAGE

Shadows are *expensive*, and a big part of the reason why light sources are seen as expensive. A light only casts shadows if you *ask* it to, any many smaller lights indeed don't have much to gain from shadows. But even if you turn shadows on for a light, you *also* need to tell Unity which objects can cast shadows. Again, shadows are expensive, so if you can afford to not give an object a shadow (or perhaps a simpler shadow), that's much better for performance.

This gives us the `SHADOWCASTER` pass. Before the forward pass runs, shadows are computed. The light source becomes a camera, and looks at how far away everything is. Only the nearest surface sees the sunlight. Anything further away is in the shadow of the nearer thing.

IMAGE

When the light becomes a camera to do these calculations, all objects in the scene have their `ShadowCaster` pass called. This determines the geometry the light sees. The default `SHADOWCASTER` pass just grabs the original mesh, but you can imagine working with simplified geometry instead.

IMAGE

This gives us a pipeline of *first* computing the shadows with `SHADOWCASTER`, and *only then* computing the actual light seen in `FORWARD`. This gives us a fully shaded scene with one directional light.

IMAGE

But just one light is a little tragic. You can't do much of interest with that. More complex scenes have more light, and that is what the `FORWARD_DELTA` pass is for. Where `FORWARD` computes the "base" shaded colour of your object, `FORWARD_DELTA` *only* tells you how to change this colour when adding a new light. If you add a point light source to your scene, the `FORWARD_DELTA` pass only tells you that some portions get some extra colour.

IMAGE

Again, these extra lights may also cast shadows. You can't use the shadow information from different lights, so you need to recompute everything, giving another `SHADOWCASTER` pass. And if you add more lights, this only gets worse![^1] The forward pipeline in Unity can be summarised in the following diagram:

DIAGRAM LIKE THE EXECUTION OF EVENT FUNCTIONS EXCEPT NOW ITS SHADER PASSES YAY

Into the weeds
==============
There's some good news, and some bad news.

If you want to shade voxels per-texture-pixel, the shadowcasting pass can stay unchanged.[^2] We're going to be using the same shadow maps as "vanilla" Unity, so let's just be lazy.[^3]

```shaderlab
// In our custom shader file.
Pass {
    Name "Voxel Shadowcaster"
    Tags { "LightMode" = "ShadowCaster" }
    ...
    #pragma vertex vertShadowCaster
    #pragma fragment fragShadowCaster
    #include "UnityStandardShadow.cginc"
}
```

This was the good news. The bad news is everything else.

You see, Unity is a pretty old engine, made to handle pretty old hardware. Lighting calculations are not cheap, and you really don't want to do those computations per-pixel in, say, 2010 web games. This means that lighting calculations (or at least the harder parts) happen in the *vertex shader*, and only get interpolated in the fragment shader. However, I want the lighting to change per texture-pixel. In other words, I need to do the lighting calculations in the fragment shader. (TODO: Better distinguish between vertex/fragment workloads for lighting computations)

But then the shader code also *looks* like what you'd expect of a pretty old engine made to support everything in existence. It's also *shader code*, which really wants to do everything at compile-time if possible -- branching in shaders is a no-go.

This results in [code](https://github.com/TwoTailsGames/Unity-Built-in-Shaders/blob/master/CGIncludes/AutoLight.cginc) where everything's connected to random keywords, your structs don't have the decency to stay the same size through shader variants, and there's massive chains of include files.

Let's look at the `FORWARD` pass mentioned above. Its vertex and fragment functions are `vertBase` and `fragBase`, both of which can be found in [`UnityStandardCoreForward.cginc`](https://github.com/TwoTailsGames/Unity-Built-in-Shaders/blob/master/CGIncludes/UnityStandardCoreForward.cginc). Well, what do they look like?

```hlsl
#include "UnityStandardConfig.cginc"

#if UNITY_STANDARD_SIMPLE
    #include "UnityStandardCoreForwardSimple.cginc"
    VertexOutputBaseSimple vertBase (VertexInput v) {
        return vertForwardBaseSimple(v);
    }
    half4 fragBase (VertexOutputBaseSimple i) : SV_Target {
        return fragForwardBaseSimpleInternal(i);
    }
#else
    #include "UnityStandardCore.cginc"
    VertexOutputForwardBase vertBase (VertexInput v) {
        return vertForwardBase(v);
    }
    half4 fragBase (VertexOutputForwardBase i) : SV_Target {
        return fragForwardBaseInternal(i);
    }
#endif
```

Depending on whether a constant (documented in `UnityStandardConfig.cginc`) is set, our vertex shader has one of two completely different signatures, and delegates to either [`UnityStandardCoreForwardSimple.cginc`](https://github.com/TwoTailsGames/Unity-Built-in-Shaders/blob/master/CGIncludes/UnityStandardCoreForwardSimple.cginc) or [`UnityStandardCore.cginc`](https://github.com/TwoTailsGames/Unity-Built-in-Shaders/blob/master/CGIncludes/UnityStandardCore.cginc). The same holds for the fragment shader. Once you dive into the weeds and get used to this, these design choices make *sense*, but up until then, it's just pure suffering.

But well, we're digging to see how we can compute lighting information in the fragment shader based on what Unity does in the vertex shaders. I'm going to follow the not-`UNITY_STANDARD_SIMPLE` branch. (TODO: Justification)

A lot is happening in [`vertForwardBase(v)`](https://github.com/TwoTailsGames/Unity-Built-in-Shaders/blob/master/CGIncludes/UnityStandardCore.cginc#L375). However, most of this is setup we don't need to bother with for now. The lighting calculations start only at line 411.

```hlsl
//We need this for shadow receiving
UNITY_TRANSFER_LIGHTING(o, v.uv1);

o.ambientOrLightmapUV = VertexGIForward(v, posWorld, normalWorld);
```

My voxel project won't be working with global illumination -- that's just not something you can do in a real-time, fully destructible environment. So the only thing that's actually interesting for us is the `UNITY_TRANSFER_LIGHTING` macro, which can be found in [`AutoLight.cginc`](https://github.com/TwoTailsGames/Unity-Built-in-Shaders/blob/master/CGIncludes/AutoLight.cginc#L296), and unrolls to:

```hlsl
COMPUTE_LIGHT_COORDS(o);
UNITY_TRANSFER_SHADOW(o, v.uv1);
```

Inside the `#define` soup a little higher up, there are branches that actually need the `UNITY_TRANSFER_SHADOW`'s second argument to properly compute shadow information. However, in the cases I care about, it's just redefined into `TRANSFER_SHADOW(o);`, and we don't need to use that argument.

[/block]

[^1]: The initial `FORWARD` pass does do a nice little optimisation. The four "least important" point light sources that don't cast shadows are included in this pass directly, instead of taking up a full `FORWARD_DELTA` pass.
[^2]: Theoretically (very theoretically) you could modify your geometry to align with the camera and casts pixel-shaped shadows. This is such a (1) terrible and (2) difficult-to-implement idea, I'll be impressed if anyone manages it though.
[^3]:
    Annoyingly, this is not the code in my actual voxel repo; I couldn't *actually* affort to be lazy.

    You see, my voxels don't have any normal or uv data sent with the vertices. I do this to save GPU bandwidth. In fact, as my voxels are inside a contextual 32×32×32 chunk game object, I can make my vertices *just one int in size*. I'm not even sending the usual `Vector4 position`!

    ```hlsl
    struct appdata {
        // Contained in the factors, you get:
        //   #1: factor 33: x-position 0, .., 32
        //   #2: factor 33: y-position 0, .., 32
        //   #3: factor 33: z-position 0, .., 32
        //   #4: remainder:   material 0, .., 119513
        uint data : BLENDINDICES;
    };
    ```

    Because of this, I need to extract and compute the normal and uv data [manually](https://github.com/Atrufulgium/Voxel/blob/main/Voxel/Assets/Code/Shaders/VoxelHelpers.cginc). I do this in the tessellation stage, as there's no good way to otherwise compute the normal on the GPU. (I tried screen-based methods, but... eh.)

    [Once I have recovered all ordinary parameters](https://github.com/Atrufulgium/Voxel/blob/main/Voxel/Assets/Code/Shaders/VoxelShadowContent.cginc), I put everything into a format Unity's [`UnityStandardShadow.cginc`](https://github.com/TwoTailsGames/Unity-Built-in-Shaders/blob/master/CGIncludes/UnityStandardShadow.cginc) can deal with, and *finally* defer to the built-in Unity way by just calling `vertShadowCaster`.

{:/nomarkdown}