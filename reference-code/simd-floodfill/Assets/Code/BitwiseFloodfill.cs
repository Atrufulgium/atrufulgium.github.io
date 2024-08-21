using System.Collections.Generic;
using System.Text;
using Unity.Mathematics;

namespace Atrufulgium.SiteReferenceCode.Floodfill {
    class BitwiseFloodfill : AbstractFloodfill {

        readonly uint[] image = new uint[32 * 32];
        readonly uint[] output = new uint[32 * 32];

        public override void FloodFill() {
            int2 seed = default;
            output[seed.y] = 1u << seed.x;

            Stack<int> unhandled = new();
            unhandled.Push(seed.y);

            while (unhandled.TryPop(out int y)) {
                uint mask = ~image[y];
                uint oldRow = output[y];
                uint tempRow;
                uint newRow = oldRow;
                do {
                    tempRow = newRow;
                    newRow |= (newRow << 1) | (newRow >> 1);
                    newRow &= mask;
                } while (newRow != tempRow);

                if (y > 0)
                    newRow |= output[y - 1];
                if (y < 31)
                    newRow |= output[y + 1];
                newRow &= mask;

                if (newRow != oldRow) {
                    if (y > 0)
                        unhandled.Push(y - 1);
                    if (y < 31)
                        unhandled.Push(y + 1);
                }
                output[y] = newRow;
            }
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
    }
}
