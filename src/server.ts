import { MongoClient } from "mongodb";
import * as core from "express-serve-static-core";
import express from "express";
import * as gamesController from "./controllers/games.controller";
import * as nunjucks from "nunjucks";
import * as platformsController from "./controllers/platforms.controller";
import GameModel, { Game } from "./models/gameModel";
import PlatformModel, { Platform } from "./models/platformModel";
import bodyParser from "body-parser";
import session from "express-session";
import mongoSession from "connect-mongo";
import OAuth2Client, { OAuth2ClientConstructor } from "@fwl/oauth2";

const clientWantsJson = (request: express.Request): boolean => request.get("accept") === "application/json";

const jsonParser = bodyParser.json();
const formParser = bodyParser.urlencoded({ extended: true });

export function makeApp(mongoClient: MongoClient): core.Express {
  const app = express();
  const db = mongoClient.db();
  nunjucks.configure("views", {
    autoescape: true,
    express: app,
  });

  app.use("/assets", express.static("public"));
  app.set("view engine", "njk");

  const platformModel = new PlatformModel(db.collection<Platform>("platforms"));
  const gameModel = new GameModel(db.collection<Game>("games"));

  const mongoStore = mongoSession(session);
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  const sessionParser = session({
    secret: "&7imnQy5v0QL4$o7^jL#^#zEk#3vM31yhs",
    name: "sessionId",
    resave: false,
    saveUninitialized: true,
    store: new mongoStore({
      client: mongoClient,
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      expires: new Date(Date.now() + 3600000),
    },
  });
  const oauthClientConstructorProps: OAuth2ClientConstructor = {
    openIDConfigurationURL: "https://fewlines.connect.prod.fewlines.tech/.well-known/openid-configuration",
    clientID: `${process.env.CLIENT_ID}`,
    clientSecret: `${process.env.CLIENT_SECRET}`,
    redirectURI: "http://localhost:8080/oauth/callback",
    audience: `${process.env.AUDIENCE}`,
    scopes: ["email"],
  };

  const oauthClient = new OAuth2Client(oauthClientConstructorProps);


   app.get("/oauth/callback", sessionParser, (request: Request, response: Response) => {
    // get back an Access Token from an OAuth2 Authorization Code
    if (request.session) {
      request.session.accessToken = token.access_token;
    }
    response.redirect("/loggued-in-part-of-your-app");
  }); 

  app.get("/login", async (_request, response) => {
    const authURL = await oauthClient.getAuthorizationURL("state");

    const authURLinString = authURL.toString();
    response.redirect(authURLinString);
  });

  app.get("/", (_request, response) => response.render("pages/home"));
  app.get("/api", (_request, response) => response.render("pages/api"));

  app.get("/platforms", platformsController.index(platformModel));
  app.get("/platforms/new", platformsController.newPlatform());
  app.get("/platforms/:slug", platformsController.show(platformModel));
  app.get("/platforms/:slug/edit", platformsController.edit(platformModel));
  app.post("/platforms", jsonParser, formParser, platformsController.create(platformModel));
  app.put("/platforms/:slug", jsonParser, platformsController.update(platformModel));
  app.post("/platforms/:slug", formParser, platformsController.update(platformModel));
  app.delete("/platforms/:slug", jsonParser, platformsController.destroy(platformModel));

  app.get("/platforms/:slug/games", gamesController.list(gameModel));
  app.get("/games", gamesController.index(gameModel));
  app.get("/games/new", gamesController.newGame());
  app.get("/games/:slug", gamesController.show(gameModel));
  app.get("/games/:slug/edit", gamesController.edit(gameModel));
  app.post("/games", jsonParser, formParser, gamesController.create(gameModel, platformModel));
  app.put("/games/:slug", jsonParser, gamesController.update(gameModel, platformModel));
  app.post("/games/:slug", formParser, gamesController.update(gameModel, platformModel));
  app.delete("/games/:slug", jsonParser, gamesController.destroy(gameModel));

  app.get("/*", (request, response) => {
    console.log(request.path);
    if (clientWantsJson(request)) {
      response.status(404).json({ error: "Not Found" });
    } else {
      response.status(404).render("pages/not-found");
    }
  });

  return app;
}
