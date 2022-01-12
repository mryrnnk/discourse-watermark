import { withPluginApi } from "discourse/lib/plugin-api";
import Category from "discourse/models/category";
import { default as renderWatermarkDataURL } from "../helpers/render-watermark";
import { getComputedColor, getComputedFont } from "../helpers/computed-values";

export default {
  name: "watermark-background-widget",

  initialize() {
    const onlyInCategories = settings.only_in_categories
      .split("|")
      .map((v) => parseInt(v, 10));
    const exceptInCategories = settings.except_in_categories
      .split("|")
      .map((v) => parseInt(v, 10));

    withPluginApi("0.8", (api) => {
      api.createWidget("watermark-background-widget", {
        tagName: `div#watermark-background.${
          settings.scroll_enabled ? "scroll" : "fixed"
        }`,

        getCurrentCategories(router) {
          const currentRoute = router.currentRoute;

          if (currentRoute === null) return null;

          let category = null;

          // topics
          if (
            currentRoute.name === "topic.fromParams" ||
            currentRoute.name === "topic.fromParamsNear"
          ) {
            category = Category.findById(
              currentRoute.parent.attributes.category_id
            );
          }

          // categories
          if (
            currentRoute.params.hasOwnProperty("category_slug_path_with_id")
          ) {
            category = Category.findBySlugPathWithID(
              currentRoute.params.category_slug_path_with_id
            );
          }

          if (category) {
            const categories = [category.id];

            // just in case there is some discourse out there with more than two levels of categories
            do {
              categories.push(category.parent_category_id);
              category = category.parentCategory;
            } while (category && category.parentCategory);

            return categories;
          }

          return null;
        },

        init() {
          const container = Discourse.__container__;
          const router = container.lookup("router:main");

          Ember.run.schedule("afterRender", () => {
            const categories = this.getCurrentCategories(router);

            let showWatermark = true;

            // watermark applied by categories
            if (onlyInCategories.length > 0 || exceptInCategories.length > 0) {
              const testOnlyCategories =
                categories &&
                categories.find((id) => onlyInCategories.indexOf(id) > -1);
              const testExceptCategories =
                testOnlyCategories &&
                categories.every((id) => exceptInCategories.indexOf(id) === -1);
              showWatermark = testOnlyCategories && testExceptCategories;
            }

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

            const watermark = showWatermark
              ? renderWatermarkDataURL(
                  canvas,
                  {
                    ...settings,
                    color: resolvedColor,
                    display_text_font: resolvedTextFont,
                    display_username_font: resolvedUsernameFont,
                    display_timestamp_font: resolvedTimestampFont,
                  },
                  data
                )
              : null;

            if (watermark)
              watermarkDiv.style.backgroundImage = `url(${watermark})`;
            else watermarkDiv.style.backgroundImage = "";
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
