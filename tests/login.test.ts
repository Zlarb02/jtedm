import { openBrowser, closeBrowser, goto, text, waitFor } from "taiko";
import * as dotenv from "dotenv";
dotenv.config();

describe("my first end to end test", () => {
  jest.setTimeout(20000);

  beforeAll(async () => {
    await openBrowser({
      args: [
        "--window-size=1280,800",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--no-first-run",
        "--no-sandbox",
        "--no-zygote",
      ],
      headless: false,
    });
  });
  afterAll(async () => {
    await closeBrowser();
  });

  test("launch the appli to see if there is 'games' somewhere", async () => {
    expect.assertions(1);
    const website = process.env.URL || "";
    await goto(`${website}`);
    await waitFor("Video Games Database");
    expect(await text("Games").exists()).toBeTruthy();
  });
});
