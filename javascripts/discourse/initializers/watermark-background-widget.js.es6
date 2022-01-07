import { withPluginApi } from "discourse/lib/plugin-api";
import { default as renderWatermarkDataURL } from "../helpers/render-watermark";
import { getComputedColor, getComputedFont } from "../helpers/computed-values";

export default {
  name: "watermark-background-widget",

  initialize() {
    withPluginApi("0.8", (api) => {
      api.createWidget("watermark-background-widget", {
        tagName: `div#watermark-background.${
          settings.scroll_enabled ? "scroll" : "fixed"
        }`,

        init() {
          Ember.run.schedule("afterRender", () => {
            const canvas = document.createElement("canvas");
            const watermarkDiv = document.getElementById(
              "watermark-background"
            );

            // we will use the dom element to resolve the CSS color even if
            // the user specify a CSS variable
            const resolvedColor = getComputedColor(
              watermarkDiv,
              settings.color
            );

            // now we will use the same trick to resolve the fonts
            const resolvedTextFont = getComputedFont(
              watermarkDiv,
              settings.display_text_font
            );
            const resolvedUsernameFont = getComputedFont(
              watermarkDiv,
              settings.display_username_font
            );
            const resolvedTimestampFont = getComputedFont(
              watermarkDiv,
              settings.display_timestamp_font
            );

            const currentUser = api.getCurrentUser();
            const data = {
              username: settings.display_username
                ? currentUser?.username
                : null,
              timestamp: settings.display_timestamp
                ? moment().format(settings.display_timestamp_format)
                : null,
            };

            const watermark = renderWatermarkDataURL(
              canvas,
              {
                ...settings,
                color: resolvedColor,
                display_text_font: resolvedTextFont,
                display_username_font: resolvedUsernameFont,
                display_timestamp_font: resolvedTimestampFont,
              },
              data
            );

            if (watermark)
              watermarkDiv.style.backgroundImage = `url(${watermark})`;
          });
        },

        html() {
          // don't really want any content in the watermark div.
          // just need it to be there
          return null;
        },
      });

      api.decorateWidget("watermark-background-widget:after", (helper) => {
        helper.widget.appEvents.on("page:changed", () => {
          helper.widget.scheduleRerender();
        });
      });
    });
  },
};
