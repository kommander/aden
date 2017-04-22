```
Webserver     Request        Response
/index.html   -> /           -> index.html
/index.js     -> /index.js   -> index.js
/index.css    -> /index.css  -> index.css

App           Request        Response
/webpack.dev.js
/webpack.prod.js
/config/dev.js
/config/prod.js
/server/app.js
/server/routes.js
/server/controller.js
/runner.js
/client/index.html   -> /           -> index.html
/client/index.js     -> /index.js   -> index.js
/client/index.css    -> /index.css  -> index.css



Aden
/index.html -> / -> index.html
/index.js             -> bundle.js
                           -> commons.js
                           -> bundle.css
```
