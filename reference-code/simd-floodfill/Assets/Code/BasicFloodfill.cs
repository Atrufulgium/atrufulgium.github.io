using System.Collections.Generic;
using System.Text;
using Unity.Mathematics;

namespace Atrufulgium.SiteReferenceCode.Floodfill {
    class BasicFloodfill : AbstractFloodfill {

        readonly bool[] image = new bool[32 * 32];
        readonly bool[] output = new bool[32 * 32];

        public override void FloodFill() {
            int2 seed = default;
            Stack<int2> unhandled = new();
            unhandled.Push(seed);

            while (unhandled.TryPop(out int2 pixel)) {
                int index = pixel.x + 32 * pixel.y;
                if (image[index])
                    continue;

                if (output[index])
                    continue;

                output[index] = true;
                if (pixel.y > 0)
                    unhandled.Push(new int2(pixel.x, pixel.y - 1));
                if (pixel.y < 31)
                    unhandled.Push(new int2(pixel.x, pixel.y + 1));
                if (pixel.x > 0)
                    unhandled.Push(new int2(pixel.x - 1, pixel.y));
                if (pixel.x < 31)
                    unhandled.Push(new int2(pixel.x + 1, pixel.y));
            }
        }

        public override void PrepareFloodfill(int seed) {
            int i = 0;
            foreach (var b in GenerateImage(seed)) {
                image[i] = b;
                output[i] = false;
                i++;
            }
        }

        public override string PrintFill() {
            StringBuilder sb = new(32 * 33);
            for (int y = 0; y < 32; y++) {
                for (int x = 0; x < 32; x++) {
                    int index = x + 32 * y;

                    if (image[index])
                        sb.Append('#');
                    else if (output[index])
                        sb.Append('.');
                    else
                        sb.Append(' ');
                }
                sb.Append('\n');
            }
            return sb.ToString();
        }
    }
}
