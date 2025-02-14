#!/usr/bin/env bun

import { argv, exit } from "node:process";
import {
  CompetitionInfo,
  CompetitionRoundInfo,
} from "../src/generate/data/competiton";
import { events, EventID } from "../src/generate/data/events";
import { RoundFormatID } from "../src/generate/data/rounds";
import { sharedDOMParser } from "../src/generate/jsdom";
import { COMPETITON_SOURCE_DATA_FOLDER } from "../src/generate/processing/folders";

const args = argv.slice(2);
const competitionID = args.splice(0, 1)[0];

const competitionWCAURL = `https://www.worldcubeassociation.org/competitions/${competitionID}`;
const html = sharedDOMParser.parseFromString(
  await (await fetch(competitionWCAURL)).text(),
  "text/html",
);

const fullName = html
  .querySelector("#competition-data h3")
  ?.textContent?.trim();
if (!fullName) {
  console.error(
    `Could not look up the competition name. Please ensure the competition exists on the WCA website: ${competitionWCAURL}`,
  );
  exit(1);
}
console.log(`Found competition at: ${competitionWCAURL}`);
const date =
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  `${html
    .querySelector('a[title="Add to calendar"]')!
    .parentElement!.textContent!.trim()} // change this to the format \`YYYY-MM-DD\`! For a multi-day comp, pick the final day of the competition if unsure on which date the specific event ended.`;

const roundsByEvent: Record<EventID, CompetitionRoundInfo[]> = {};
for (const eventID of args) {
  const eventMetadata = events[eventID];
  if (!eventMetadata) {
    throw new Error(`Unknown event: ${eventID}`);
  }
  roundsByEvent[eventID] = [
    {
      roundFormatID: RoundFormatID.AverageOf5,
      roundEndDate: date,
    },
  ];
}

const competitionInfo: CompetitionInfo = {
  id: competitionID,
  fullName,
  roundsByEvent,
};

const outputDataFolder = await COMPETITON_SOURCE_DATA_FOLDER.getRelative(
  competitionID,
).ensureFolderExists();
const outputFilePath = outputDataFolder.getRelative("competition-info.json");

const roundResultFolder = await outputDataFolder
  .getRelative("round-results")
  .ensureFolderExists();
for (const [eventID, competitionRoundInfos] of Object.entries(
  competitionInfo.roundsByEvent,
)) {
  for (let i = 1; i <= competitionRoundInfos.length; i++) {
    roundResultFolder.getRelative(`${eventID}-round${i}.csv`).touchFile();
  }
}

console.log(`Writing: ${outputFilePath}`);
await outputFilePath.writeJSON(competitionInfo);
