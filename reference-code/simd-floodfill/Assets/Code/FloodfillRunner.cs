using System;
using System.Diagnostics;

namespace Atrufulgium.SiteReferenceCode.Floodfill {
    static class FloodfillRunner {
        // Using "Range" here is not fully correct but I wanna write 1..100.
        // A range of size 1 also prints the result.
        public static void Run<T>(Range rngSeeds) where T : AbstractFloodfill {
            T floodFill = Activator.CreateInstance<T>();
            Stopwatch sw = new();

            int lower = rngSeeds.Start.Value;
            int upper = rngSeeds.End.Value;
            for (int rngSeed = lower; rngSeed < upper; rngSeed++) {
                floodFill.PrepareFloodfill(rngSeed);
                sw.Start();
                floodFill.FloodFill();
                sw.Stop();
            }
            UnityEngine.Debug.Log($"[{typeof(T).Name}] Seeds {rngSeeds} ({upper - lower}) took {sw.ElapsedTicks} ticks.");
            if (upper == lower + 1)
                UnityEngine.Debug.Log(floodFill.PrintFill());

            if (floodFill is IDisposable disposable)
                disposable.Dispose();
        }
    }
}