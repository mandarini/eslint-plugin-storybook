/**
 * @fileoverview A story file must contain at least one story export
 * @author Yann Braga
 */


import { createStorybookRule } from '../utils/create-storybook-rule'
import { CategoryId } from '../utils/constants'
import {
  getAllNamedExports,
  getDescriptor,
  getMetaObjectExpression,
  isValidStoryExport,
} from '../utils'
import { isImportDeclaration } from '../utils/ast'
import { IncludeExcludeOptions } from '@storybook/csf'
import { TSESTree } from "@typescript-eslint/utils";

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export = createStorybookRule({
  name: 'story-exports',
  defaultOptions: [],
  meta: {
    type: 'problem',
    docs: {
      description: 'A story file must contain at least one story export',
      categories: [CategoryId.RECOMMENDED, CategoryId.CSF],
      recommended: 'error',
    },
    messages: {
      shouldHaveStoryExport: 'The file should have at least one story export',
      shouldHaveStoryExportWithFilters:
        'The file should have at least one story export. Make sure the includeStories/excludeStories you defined are correct, otherwise Storybook will not use any stories for this file.',
      addStoryExport: 'Add a story export',
    },
    fixable: undefined, // change to 'code' once we have autofixes
    schema: [],
  },

  create(context) {
    // variables should be defined here

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    let hasStoriesOfImport = false
    let nonStoryExportsConfig: IncludeExcludeOptions = {}
    let meta: TSESTree.ObjectExpression | null
    let namedExports: TSESTree.Identifier[] = []

    return {
      ImportSpecifier(node) {
        if (node.imported.name === 'storiesOf') {
          hasStoriesOfImport = true
        }
      },
      ExportDefaultDeclaration: function (node) {
        meta = getMetaObjectExpression(node, context)
        if (meta) {
          try {
            nonStoryExportsConfig = {
              excludeStories: getDescriptor(meta, 'excludeStories'),
              includeStories: getDescriptor(meta, 'includeStories'),
            }
          } catch (err) {}
        }
      },
      ExportNamedDeclaration: function (node) {
        namedExports.push(...getAllNamedExports(node))
      },
      'Program:exit': function (program: TSESTree.Program) {
        if (hasStoriesOfImport || !meta) {
          return
        }

        const storyExports = namedExports.filter((exp) =>
          isValidStoryExport(exp, nonStoryExportsConfig)
        )

        if (storyExports.length) {
          return
        }

        const firstNonImportStatement = program.body.find((n) => !isImportDeclaration(n))
        const node = firstNonImportStatement || program.body[0] || program

        // @TODO: bring apply this autofix with CSF3 release
        // const fix = (fixer) => fixer.insertTextAfter(node, `\n\nexport const Default = {}`)

        const hasFilter =
          nonStoryExportsConfig.includeStories || nonStoryExportsConfig.excludeStories
        const report = {
          node,
          messageId: hasFilter ? 'shouldHaveStoryExportWithFilters' : 'shouldHaveStoryExport',
          // fix,
        } as const

        context.report(report)
      },
    }
  },
})
