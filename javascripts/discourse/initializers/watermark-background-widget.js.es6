import { withPluginApi } from "discourse/lib/plugin-api";
import Category from "discourse/models/category";
import { default as renderWatermarkDataURL } from "../helpers/render-watermark";
import { getComputedColor, getComputedFont } from "../helpers/computed-values";

export default {
  name: "watermark-background-widget",

  initialize() {
    const onlyInCategories = settings.only_in_categories
      .split("|")
      .filter((id) => id !== "")
      .map((v) => parseInt(v, 10));
    const exceptInCategories = settings.except_in_categories
      .split("|")
      .filter((id) => id !== "")
      .map((v) => parseInt(v, 10));
    const onlyInTags = settings.only_in_tags
      .split("|")
      .filter((id) => id !== "");
    const exceptInTags = settings.except_in_tags
      .split("|")
      .filter((id) => id !== "");

    withPluginApi("0.8", (api) => {
      api.createWidget("watermark-background-widget", {
        tagName: `div#watermark-background.${
          settings.scroll_enabled ? "scroll" : "fixed"
        }`,

        getCurrentCategories(router) {
          const currentRoute = router.currentRoute;

          if (currentRoute === null) return [];

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

            return categories.filter((id) => id != null);
          }

          return [];
        },

        getCurrentTags(router) {
          const currentRoute = router.currentRoute;

          if (currentRoute === null) return [];

          // topics
          if (
            currentRoute.name === "topic.fromParams" ||
            currentRoute.name === "topic.fromParamsNear"
          ) {
            return currentRoute.parent.attributes.tags;
          }

          // categories
          if (currentRoute.params.hasOwnProperty("tag_id")) {
            return [currentRoute.params.tag_id];
          }

          return [];
        },

        shouldShowWatermark() {
          const container = this.container;
          const router = container.lookup("router:main");

          let showWatermark = true;

          // watermark applied by categories
          if (onlyInCategories.length > 0 || exceptInCategories.length > 0) {
            const categories = this.getCurrentCategories(router);

            const testOnlyCategories =
              onlyInCategories.length === 0 ||
              categories.find((id) => onlyInCategories.indexOf(id) > -1);
            const testExceptCategories =
              testOnlyCategories &&
              (exceptInCategories.length === 0 ||
                categories.every(
                  (id) => exceptInCategories.indexOf(id) === -1
                ));
            showWatermark = testOnlyCategories && testExceptCategories;
          }

          // watermark applied by tags
          // note that the test will be additive (&&) to the categories filter
          if (
            showWatermark &&
            (onlyInTags.length > 0 || exceptInTags.length > 0)
          ) {
            const tags = this.getCurrentTags(router);

            const testOnlyTags =
              onlyInTags.length === 0 ||
              tags.find((id) => onlyInTags.indexOf(id) > -1);
            const testExceptTags =
              testOnlyTags &&
              (exceptInTags.length === 0 ||
                tags.every((id) => exceptInTags.indexOf(id) === -1));
            showWatermark = testOnlyTags && testExceptTags;
          }

          return showWatermark;
        },

        getDomElement() {
          return document.getElementById("watermark-background");
        },

        clearWatermark() {
          const watermarkDiv = this.getDomElement();
          watermarkDiv.style.backgroundImage = "";
        },

        renderWatermark() {
          const watermarkDiv = this.getDomElement();
          const canvas = document.createElement("canvas");

          // we will use the dom element to resolve the CSS color even if
          // the user specify a CSS variable
          const resolvedColor = getComputedColor(watermarkDiv, settings.color);

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
            username: settings.display_username ? currentUser?.username : null,
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

          const backgroundImage = `url(${watermark})`;
          if (watermarkDiv.style.backgroundImage !== backgroundImage) {
            watermarkDiv.style.backgroundImage = backgroundImage;
          }
        },

        init() {
          // updates the watermark after renders
          Ember.run.schedule("afterRender", () => {
            if (this.shouldShowWatermark()) {
              this.renderWatermark();
              return;
            }

            this.clearWatermark();
          });
        },

        html() {
          // don't really want any content in the watermark div.
          // just need it to be there
          return null;
        },
      });

      api.decorateWidget("watermark-background-widget:after", (helper) => {
        const appEvents = helper.widget.appEvents;

        const triggerEvents = [
          // render on every page chance
          "page:changed",
          // updates the watermark again if the header of the topic was updated
          // in case the category or tags were edited
          "header:update-topic",
        ];

        // event binding
        triggerEvents.forEach((eventName) =>
          appEvents.on(eventName, () => {
            helper.widget.scheduleRerender();
          })
        );
      });
    });
  },
};
