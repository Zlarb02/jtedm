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

  app.get("/login", async (_request, response) => {
    const authURL = await oauthClient.getAuthorizationURL("state");

    const authURLinString = authURL.toString();
    response.redirect(authURLinString);
  });
  app.get("/logout", sessionParser, async (_request, response) => {
    if (_request.session) {
      _request.session.destroy(() => {
        response.render("pages/home", { isLoggedIn: false });
      });
    }
  });

  app.get("/oauth/callback", sessionParser, async (request, response) => {
    const stringiAuthCode = `${request.query.code}`;
    const token = await oauthClient.getTokensFromAuthorizationCode(stringiAuthCode);
    if (request.session) {
      request.session.accessToken = token.access_token;
    }
    response.redirect("/");
  });

  app.get("/", sessionParser, async (request, response) => {
    if (!request.session || !request.session.accessToken) {
      response.render("pages/home", { isLoggedIn: false });
      console.log("you are not conected");
      return;
    }
    try {
      await oauthClient.verifyJWT(request.session.accessToken, process.env.JWT_ALGORITHM || "");
      response.render("pages/home", { isLoggedIn: true });
      console.log("you are conected");
    } catch (error) {
      request.session.destroy(() => {
        response.render("pages/home", { isLoggedIn: false });
        console.error(error);
      });
    }
  });
  app.get("/api", (_request, response) => response.render("pages/api"));

  app.get("/platforms", sessionParser, platformsController.index(platformModel));
  app.get("/platforms/new", sessionParser, platformsController.newPlatform());
  app.get("/platforms/:slug", sessionParser, platformsController.show(platformModel));
  app.get("/platforms/:slug/edit", sessionParser, platformsController.edit(platformModel));
  app.post("/platforms", sessionParser, jsonParser, formParser, platformsController.create(platformModel));
  app.put("/platforms/:slug", sessionParser, jsonParser, platformsController.update(platformModel));
  app.post("/platforms/:slug", sessionParser, formParser, platformsController.update(platformModel));
  app.delete("/platforms/:slug", sessionParser, jsonParser, platformsController.destroy(platformModel));

  app.get("/platforms/:slug/games", sessionParser, gamesController.list(gameModel));
  app.get("/games", sessionParser, gamesController.index(gameModel));
  app.get("/games/new", sessionParser, gamesController.newGame());
  app.get("/games/:slug", sessionParser, gamesController.show(gameModel));
  app.get("/games/:slug/edit", sessionParser, gamesController.edit(gameModel));
  app.post("/games", sessionParser, jsonParser, formParser, gamesController.create(gameModel, platformModel));
  app.put("/games/:slug", sessionParser, jsonParser, gamesController.update(gameModel, platformModel));
  app.post("/games/:slug", sessionParser, formParser, gamesController.update(gameModel, platformModel));
  app.delete("/games/:slug", sessionParser, jsonParser, gamesController.destroy(gameModel));

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
