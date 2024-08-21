using System;
using System.Text;
using Unity.Burst;
using Unity.Burst.CompilerServices;
using Unity.Collections;
using Unity.Collections.LowLevel.Unsafe;
using Unity.Jobs;
using Unity.Mathematics;
using static Unity.Mathematics.math;

namespace Atrufulgium.SiteReferenceCode.Floodfill {
    class BitwiseSIMDFloodfill : AbstractFloodfill, IDisposable {

        NativeArray<uint> image = new(32 * 32, Allocator.Persistent);
        NativeArray<uint> output = new(32 * 32, Allocator.Persistent);
        NativeReference<int2> seed = new(default, Allocator.Persistent);

        FillJob fillJob;

        [BurstCompile(CompileSynchronously = true, OptimizeFor = OptimizeFor.Performance)]
        private struct FillJob : IJob {
            public NativeArray<uint> imageRef;
            public NativeArray<uint> outputRef;
            public NativeReference<int2> seedRef;

            public unsafe void Execute() {
                uint* image = (uint*)imageRef.GetUnsafePtr();
                uint* output = (uint*)outputRef.GetUnsafePtr();
                uint4* image4 = (uint4*)imageRef.GetUnsafePtr();
                uint4* output4 = (uint4*)outputRef.GetUnsafePtr();
                
                var seed = seedRef.Value;
                output[seed.y] = 1u << seed.x;

                // Burst doesn't like "objects" and stuff.
                // We still need something to schedule.
                int* unhandledStack = stackalloc int[32];
                unhandledStack[0] = seed.y / 4;
                int unhandledTop = 0; // -1 representing "empty"
                // In order to prevent duplicate pushes, keep track in a bitmap
                // which of the 32 y values we have pushed already.
                uint pushed = 0;

                while (Hint.Likely(unhandledTop > -1)) {
                    // Pop
                    int y = unhandledStack[unhandledTop--];
                    pushed &= ~(1u << y);

                    // Article code
                    uint4 masks = ~image4[y];
                    uint4 oldRows = output4[y];
                    uint4 tempRows;
                    uint4 newRows = oldRows;
                    do {
                        tempRows = newRows;
                        newRows |= (newRows << 1) | (newRows >> 1);
                        newRows &= masks;
                    } while (Hint.Likely(any(newRows != tempRows)));

                    // In case we're at the edge, replace the missing value with 0.
                    if (Hint.Likely(y > 0)) {
                        uint4* prevRows = (uint4*)(output + 4 * y - 1);
                        for (int i = 0; i < 3; i++) {
                            newRows |= *prevRows;
                            newRows &= masks;
                        }
                    } else {
                        for (int i = 0; i < 3; i++) {
                            newRows |= new uint4(0, newRows.xyz);
                            newRows &= masks;
                        }
                    }
                    if (Hint.Likely(y < 31)) {
                        uint4* nextRows = (uint4*)(output + 4 * y + 1);
                        for (int i = 0; i < 3; i++) {
                            newRows |= *nextRows;
                            newRows &= masks;
                        }
                    } else {
                        for (int i = 0; i < 3; i++) {
                            newRows |= new uint4(newRows.yzw, 0);
                            newRows &= masks;
                        }
                    }

                    // If there are any changes, reschedule.
                    if (Hint.Likely(any(newRows != oldRows))) {
                        uint mask;
                        if (Hint.Likely(y > 0)) {
                            // Push
                            mask = 1u << y - 1;
                            if (Hint.Unlikely((pushed & mask) == 0)) {
                                unhandledStack[++unhandledTop] = y - 1;
                                pushed |= mask;
                            }
                        }
                        if (Hint.Likely(y < 31)) {
                            // Push
                            mask = 1u << y + 1;
                            if (Hint.Unlikely((pushed & mask) == 0)) {
                                unhandledStack[++unhandledTop] = y + 1;
                                pushed |= mask;
                            }
                        }
                        // Push
                        mask = 1u << y;
                        if (Hint.Unlikely((pushed & mask) == 0)) {
                            unhandledStack[++unhandledTop] = y + 1;
                        }
                    }

                    output4[y] = newRows;
                }
            }
        }

        public override void FloodFill() {
            fillJob.Run();
        }

        public override void PrepareFloodfill(int rngSeed) {
            int x = 0;
            int y = 0;
            foreach (var b in GenerateImage(rngSeed)) {
                if (b)
                    image[y] |= 1u << x;
                x++;
                if (x == 32) {
                    x = 0;
                    y++;
                }
            }
            for (int i = 0; i < 32; i++) {
                output[i] = 0;
            }

            fillJob = new() {
                imageRef = image,
                outputRef = output,
                seedRef = seed
            };
        }

        public override string PrintFill() {
            StringBuilder sb = new(32 * 33);
            for (int y = 0; y < 32; y++) {
                for (int x = 0; x < 32; x++) {
                    uint mask = 1u << x;

                    if ((image[y] & mask) > 0)
                        sb.Append('#');
                    else if ((output[y] & mask) > 0)
                        sb.Append('.');
                    else
                        sb.Append(' ');
                }
                sb.Append('\n');
            }
            return sb.ToString();
        }

        public void Dispose() {
            image.Dispose();
            output.Dispose();
            seed.Dispose();
        }
    }
}
