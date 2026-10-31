// How to do each step of the default Cleaning schedule, by step id. Short and practical: what to use,
// in what order, what to watch out for. A step's own `how` (set in Edit) wins over these.

import type { Step } from "./cleaning";

export const HOW: Record<string, string> = {
  // Morning
  "morning-0": "Pull the sheet tight, shake out the duvet and lay it flat, pillows on top. Done is better than perfect.",
  "morning-1": "Open two windows on opposite sides for a through-draught, 10–15 minutes, then close them.",
  "morning-2": "Everything from the floor and the chair into the laundry basket. Check pockets as you go.",
  "morning-3": "One lap of the flat with a basket: cups to the kitchen, things back where they live.",
  "morning-plants": "Water when the top 2 cm of soil is dry; pour slowly until a little comes out the bottom, then empty the saucer.",
  "morning-laundry": "Shake each piece out before hanging so it dries with fewer creases. Fold and put away what's already dry.",
  // After meals
  "meals-0": "Scrape plates into the bin, rinse, then wash glasses first, cutlery, plates, and pans last in hot soapy water. Or load the dishwasher.",
  "meals-1": "Clear everything off, then spray and wipe from the back to the front, crumbs into your hand. Dry the hob so it doesn't streak.",
  "meals-2": "Food in the fridge or cupboard, bottles and jars back in their place, tea towel on its hook.",
  "meals-bowls": "Rinse Pari's bowls with hot water and wipe them dry. Fresh water in the water bowl.",
  // Evening
  "evening-0": "Cushions straight, throw folded, cups and plates to the kitchen, remote and chargers in one place.",
  "evening-1": "Bathroom, bedroom and desk bins into the big bin. New bag in each if you use them.",
  "evening-2": "Spray, wipe the basin and tap with a cloth, rinse, and dry the tap so it shines.",
  "evening-3": "Quick pass where you walk most: kitchen floor, hallway, under the table. Empty the vacuum if it's full.",
  "evening-4": "Bag packed, clothes picked, keys and phone charging by the door. Morning you will thank you.",
  "evening-rubbish": "Tie the bag, take it and the recycling down, wipe the bin lid, put a new bag in.",
  "evening-makeup": "Wet the bristles with lukewarm water (pointing down), lather with a little gentle shampoo in your palm, rinse until clear, squeeze out and dry flat or bristles down.",
  "evening-hairbrush": "Pull the hair out with a comb or your fingers, then soak the brush in warm water with a drop of shampoo for 5 minutes, rinse and dry bristles down.",
  // Monday
  "mon-0": "Toilet cleaner under the rim first so it can work. Meanwhile spray and wipe the sink and mirror. Then brush the bowl, wipe the seat, lid and outside top to bottom, and flush.",
  "mon-1": "Spray the walls and glass, leave a minute, wipe or squeegee top to bottom, rinse and wipe dry so no limescale spots stay.",
  "mon-towels": "Towels and bath rug together, 60°C, no fabric softener (towels absorb less with it). Check the rug's label first.",
  // Tuesday
  "tue-0": "Vacuum first, edges and corners too. Then mop with warm water and a little floor cleaner, from the far corner towards the door, so you don't walk on it.",
  "tue-1": "Take the mat outside and shake it hard (or beat it on the railing). Vacuum the floor underneath before putting it back.",
  "tue-whites": "Whites only, 40°C (60°C for underwear and socks). Don't overfill: a hand's width free at the top of the drum.",
  // Wednesday
  "wed-0": "Damp cloth with a little washing-up liquid, wipe the fronts and handles, then dry with a tea towel.",
  "wed-1": "Spray the tiles behind the hob and sink, leave a minute for the grease, wipe, and dry.",
  "wed-2": "Check the dates, smell the open things. Bin what's gone off, move what needs eating soon to the front.",
  "wed-3": "Run hot water, sprinkle baking soda all over the sink, scrub with a sponge (the drain area too), rinse with hot water and dry.",
  "wed-5": "Wash both bowls in hot soapy water (or the dishwasher), scrub the rims, rinse well so no soap is left, and dry.",
  "wed-colours": "Coloured clothes inside out, 30–40°C. New dark or red things wash separately the first time.",
  // Thursday
  "thu-pari-bed": "Take the cover off if it comes off, vacuum the bed with the upholstery tool, seams and corners too.",
  "thu-pari-wash": "Shake the hair off outside first. 40–60°C with a pet-safe detergent, no fabric softener. Air dry.",
  // Friday
  "fri-0": "A slightly damp microfibre cloth, top to bottom: shelves, TV stand, window sills, bedside tables. The floor gets the dust last.",
  "fri-1": "Clear the tables, wipe with a damp cloth and a little washing-up liquid, then dry.",
  "fri-2": "Vacuum the sofa with the upholstery tool: under the cushions and the seams too. Then a light spray of fabric freshener and let it dry.",
  "fri-black": "Black clothes inside out, cold or 30°C, a detergent for darks. Dry out of direct sun so they don't fade.",
  // Saturday
  "sat-0": "Strip the bed, put the sheets and pillowcases straight into the machine, then make the bed with a fresh set.",
  "sat-sheets": "Sheets and pillowcases at 60°C. Shake out well before hanging so they need no ironing.",
  "sat-2": "Damp microfibre cloth, top to bottom, the places Friday's dust missed: lamps, frames, the top of the door.",
  // Sunday
  "sun-1": "Check toilet paper, soap, shampoo, toothpaste, cleaning products. Anything low goes on the shopping list.",
  "sun-2": "Look in the fridge and cupboards, think of 3–4 meals for the week, add what's missing to the shopping list.",
  "sun-3": "10 minutes with a timer: a basket for things in the wrong room, then put them back.",
  // Monthly reset
  "monthly-0": "Pull out anything stored under the bed, vacuum with the long nozzle, wipe what you put back.",
  "monthly-1": "Take everything out (cool bag for what needs to stay cold), bin old things, remove the shelves and drawers, wash them in warm soapy water, wipe the inside with water and a little baking soda, dry and put back.",
  "monthly-2": "Empty drum. A washing machine cleaner (or 2 cups of white vinegar) in the drum, the hottest cycle. Afterwards wipe the rubber seal and the detergent drawer, and leave the door open to dry.",
  "monthly-3": "Couch throws on their label's temperature (usually 30–40°C), gentle cycle. Hang them over a rail to dry.",
  "monthly-4": "Empty the bin or bag, rinse the filters in water (only the washable ones) and let them dry 24 hours, cut the hair off the brush roll.",
  "monthly-5": "One drawer only: empty it, wipe it, put back only what you use. The rest: bin, donate or a better place.",
  "monthly-mattress": "Strip the bed, vacuum the mattress slowly with the upholstery tool, seams too. A sprinkle of baking soda 30 minutes before freshens it.",
  "monthly-protectors": "Mattress and pillow protectors at 60°C (check the label), dry fully before putting back on.",
  "monthly-drain": "Pour the drain cleaner as the bottle says and leave it the time it says, then flush with hot water. Never mix two drain products, or drain cleaner with bleach.",
  "monthly-bin": "Empty the bin, take it to the shower or balcony, spray inside and out with soapy water or a disinfectant, rinse, let it dry upside down.",
  // Kitchen deep clean
  "q-kitchen-0": "Take out the racks. Spray oven cleaner (or spread a paste of baking soda and water) on the inside, avoiding the heating elements, and let it soak 20–30 minutes (or overnight). Wipe off with a damp cloth, rinse well. Racks soak in the sink with hot water and washing-up liquid.",
  "q-kitchen-1": "Take the grease filters out of the hood and soak them in very hot water with washing-up liquid and a spoon of baking soda for 15 minutes, scrub, rinse and dry. Wipe the hood inside and out.",
  "q-kitchen-2": "One cupboard at a time: everything out, wipe the shelves with a damp cloth and a little washing-up liquid, dry, put back (bin anything expired).",
  "q-kitchen-3": "Unplug the fridge if you need to pull it out. Vacuum the dust behind and underneath (and the fridge coils), mop the floor, push back.",
  "q-kitchen-4": "Stand on a step stool, not a chair. Spray degreaser or warm soapy water on the tops, leave a minute, wipe, then dry.",
  // Living room
  "q-living-0": "Move the sofa and chairs if you can, vacuum underneath with the long nozzle, then put them back.",
  "q-living-1": "Vacuum the cushions first. Covers that zip off: wash as the label says (usually 30°C, gentle) and dry flat or hanging, then put back while slightly damp so they don't shrink. Fixed covers: spot clean with upholstery cleaner. Start early: they need hours to dry.",
  "q-living-3": "Damp cloth with a little washing-up liquid along the skirting boards, room by room; a dry cloth after. A sock on your hand works too.",
  "q-living-4": "Lights off and cool. Dust the shades and bulbs with a dry microfibre cloth; glass shades can be washed and dried fully before putting back.",
  // Pari wash day + bedroom
  "q-pari-0": "Shake it out outside, then the inner bed in the machine (if it fits) at 40°C with pet-safe detergent, no softener. Dry fully before Pari uses it again.",
  "q-pari-1": "Soak the collar, harness and leash in warm water with a little dog shampoo for 15 minutes, scrub with an old toothbrush, rinse well and hang to dry (leather: just wipe and condition, don't soak). Use the spare until they're dry.",
  "q-pari-2": "Fabric toys in the machine at 40°C in a laundry bag. Rubber and plastic toys: hot soapy water and a brush, rinse well. Let everything dry fully. Bin anything broken.",
  "q-pari-3": "Check the label: most pillows go in at 40–60°C, two at a time to keep the drum balanced, then an extra spin. Dry completely (lumps mean still damp inside).",
  "q-pari-4": "Everything out, bin what's expired, wipe the shelves with a damp cloth and dry, put back what you use.",
  // Twice a year
  "half-0": "Turn the mattress 180° (head end to foot end). Flip it over too if it's a two-sided mattress.",
  "half-1": "If the duvet fits the machine, 40–60°C as the label says, a long rinse, and dry fully (a sunny day outside). If it's too big, a laundrette.",
  // Balcony and windows
  "half-2": "Clear the balcony, sweep the floor, wipe the railing and furniture, then scrub the floor with warm water and floor cleaner and rinse. Water the plants after. Start early so the floor dries.",
  "q-living-2": "Wipe the frames and sills first. Then the glass: a little washing-up liquid in warm water (or window spray), wash, squeegee top to bottom, dry the edges with a microfibre cloth. Not in direct sun, or it streaks.",
};

/** The instructions for a step: yours from Edit, else the built-in ones. */
export function howTo(step: Pick<Step, "id" | "how">) {
  return step.how?.trim() || HOW[step.id] || "";
}
