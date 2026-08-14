import laBocana from "../../config/journeys/la-bocana.json";
import marbellaBoatCharter from "../../config/journeys/marbella-boat-charter.json";
import marbellaForSale from "../../config/journeys/marbella-for-sale.json";
import mfinity from "../../config/journeys/mfinity.json";
import noguera from "../../config/journeys/noguera.json";
import trenesYTranvias from "../../config/journeys/trenes-y-tranvias.json";
import { parseJourneyManifest, type JourneyManifest } from "@/automation/journey-schema";

const configured = [laBocana, marbellaBoatCharter, marbellaForSale, mfinity, noguera, trenesYTranvias];

export const journeyManifests = new Map<string, JourneyManifest>(
  configured.map((manifest) => {
    const parsed = parseJourneyManifest(manifest);
    return [parsed.projectId, parsed];
  }),
);

