using UnityEngine;

namespace Atrufulgium.SiteReferenceCode.Floodfill {
    public class FloodfillRunnerBehaviour : MonoBehaviour {

        // Stupid profiler not profiling the zero'th frame, tsk.
        int i = 0;
        public void Update() {
            i++;
            if (i != 2)
                return;

            // ik this could be done better
            // no idc i have the power of multi-cursor editing
            // reminder: 1 tick = 0.1μs on my machine.
            FloodfillRunner.Run<BasicFloodfill>(230..231);
            FloodfillRunner.Run<BasicFloodfill>(230..240);
            FloodfillRunner.Run<BasicFloodfill>(230..330);
            FloodfillRunner.Run<BasicFloodfill>(230..1230);
            FloodfillRunner.Run<BasicFloodfill>(230..10230);

            FloodfillRunner.Run<BitwiseFloodfill>(230..231);
            FloodfillRunner.Run<BitwiseFloodfill>(230..240);
            FloodfillRunner.Run<BitwiseFloodfill>(230..330);
            FloodfillRunner.Run<BitwiseFloodfill>(230..1230);
            FloodfillRunner.Run<BitwiseFloodfill>(230..10230);

            // Note: The performance reported here is inaccurate, as Unity,
            // *by far* spends the most time outside the actual Bursted job.
            // Highlighting `BitwiseSIMDFloodfill:FillJob` in the profiler
            // gives ~3ms for all 11k jobs.
            // So while the others are fine, this one... eh.
            FloodfillRunner.Run<BitwiseSIMDFloodfill>(230..231);
            FloodfillRunner.Run<BitwiseSIMDFloodfill>(230..240);
            FloodfillRunner.Run<BitwiseSIMDFloodfill>(230..330);
            FloodfillRunner.Run<BitwiseSIMDFloodfill>(230..1230);
            FloodfillRunner.Run<BitwiseSIMDFloodfill>(230..10230);
        }
    }
}
