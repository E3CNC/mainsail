# UI & Internationalization

## Vuetify

Use Vuetify 3 utility classes instead of custom CSS.

Documentation: [Vuetify 3 Spacing](https://vuetifyjs.com/en/styles/spacing/) | [Flex](https://vuetifyjs.com/en/styles/flex/) | [Typography](https://vuetifyjs.com/en/styles/text-and-typography/)

## Icons

Import icons from `@mdi/js`.
Expose them to the template from `<script setup>` and use in template.

Icon search: [Material Design Icons](https://pictogrammers.com/library/mdi/)

## Internationalization

All UI text must use `$t()` for localization.
No hardcoded user-facing strings.

Documentation: [vue-i18n](https://kazupon.github.io/vue-i18n/)

### Locale Files

Location: `src/locales/`
Format: JSON with alphabetically sorted keys (case-insensitive)

Sorting is enforced by ESLint/Prettier.

### Adding New Strings

1. Add to `en.json` first
2. Place in alphabetical order within the section
