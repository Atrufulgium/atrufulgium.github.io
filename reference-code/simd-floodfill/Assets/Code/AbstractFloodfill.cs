using Unity.Mathematics;
using System.Collections.Generic;

namespace Atrufulgium.SiteReferenceCode.Floodfill {
    abstract class AbstractFloodfill {
        /// <summary>
        /// Apply the algorithm as described in the post.
        /// </summary>
        public abstract void FloodFill();

        /// <summary>
        /// Generates the 32×32 pixels of the image. A value of `true`
        /// represents obstructed pixels.
        /// </summary>
        protected IEnumerable<bool> GenerateImage(int rngSeed) {
            Random rng = new((uint)rngSeed);
            for (int i = 0; i < 32 * 32; i++)
                yield return rng.NextFloat() > 0.8f;
        }

        /// <summary>
        /// Prepare the image (and possibly other stuff) needed for the
        /// floodfill here. The performance of this part is not measured.
        /// <br/>
        /// Please use <see cref="GenerateImage(uint)"/> for the image
        /// preparation. This class is supposed to be reusable, so if you
        /// store output data, reset it here also.
        /// </summary>
        public abstract void PrepareFloodfill(int rngSeed);

        /// <summary>
        /// Get a 32×32 string where `#` represents walls, `.` represents
        /// filled cells, and ` ` represents unfilled cells.
        /// </summary>
        public abstract string PrintFill();
    }
}
