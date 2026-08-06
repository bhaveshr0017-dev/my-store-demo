import { getConfigValue } from '@dropins/tools/lib/aem/configs.js';
import { CS_FETCH_GRAPHQL, rootLink } from './commerce.js';

const CATEGORIES_QUERY = `
  query getCatalogCategories($ids: [String!]!, $startLevel: Int!, $depth: Int!) {
    categories(ids: $ids, subtree: { startLevel: $startLevel, depth: $depth }) {
      id
      name
      urlPath
      urlKey
    }
  }
`;

/**
 * Builds a search PLP URL filtered to a Commerce category path.
 * @param {string} urlPath Category urlPath from Catalog Service
 * @returns {string}
 */
export function buildCategorySearchLink(urlPath) {
  const params = new URLSearchParams({
    filter: `categoryPath:${urlPath}`,
  });
  return `${rootLink('/search')}?${params.toString()}`;
}

/**
 * Fetches storefront categories from Catalog Service (excludes root with empty urlPath).
 * @returns {Promise<Array<{ id: string, name: string, urlPath: string, urlKey: string }>>}
 */
export async function fetchCatalogCategories() {
  const rootCategory = String(getConfigValue('plugins.picker.rootCategory') || '2');

  try {
    const { data, errors } = await CS_FETCH_GRAPHQL.fetchGraphQl(CATEGORIES_QUERY, {
      variables: {
        ids: [rootCategory],
        startLevel: 1,
        depth: 5,
      },
    });

    if (errors?.length) {
      console.error('Failed to fetch catalog categories', errors);
      return [];
    }

    return (data?.categories || []).filter((category) => category?.urlPath);
  } catch (error) {
    console.error('Failed to fetch catalog categories', error);
    return [];
  }
}

/**
 * Replaces the Catalog submenu with live categories from Commerce.
 * Must run before header submenu setup so nested lists are still direct children.
 * @param {Element} navSections The `.nav-sections` element
 */
export async function populateCatalogNav(navSections) {
  if (!navSections) return;

  const topItems = [
    ...navSections.querySelectorAll(':scope .default-content-wrapper > ul > li'),
  ];
  const catalogItem = topItems.find((li) => {
    const labelEl = li.querySelector(':scope > p, :scope > a');
    const label = (labelEl?.textContent || li.childNodes[0]?.textContent || '').trim();
    return label.toLowerCase() === 'catalog';
  });

  if (!catalogItem) return;

  const categories = await fetchCatalogCategories();
  if (!categories.length) return;

  let list = catalogItem.querySelector(':scope > ul');
  if (!list) {
    list = document.createElement('ul');
    catalogItem.append(list);
  }

  list.replaceChildren(
    ...categories.map((category) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = buildCategorySearchLink(category.urlPath);
      a.textContent = category.name;
      li.append(a);
      return li;
    }),
  );
}
