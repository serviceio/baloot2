import fs from "fs";
const lines = fs.readFileSync("src/App.tsx", "utf8").split("\n");
lines.splice(310, 0, "                                        </div>", "                                        )}");
fs.writeFileSync("src/App.tsx", lines.join("\n"));
