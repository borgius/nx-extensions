import { StencilBuildOptions } from './schema';
import { ConfigFlags, parseFlags, TaskCommand } from '@stencil/core/cli';
import { prepareConfigAndOutputargetPaths, createStencilProcess, initializeStencilConfig } from '../stencil-runtime';
import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { parseRunParameters } from '../stencil-runtime/stencil-parameters';
import { ExecutorContext, logger } from '@nrwl/devkit';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  updateBuildableProjectPackageJsonDependencies
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';

function createStencilCompilerOptions(
  taskCommand: TaskCommand,
  options: StencilBuildOptions
): ConfigFlags {
  let runOptions: string[] = [taskCommand];
  runOptions = parseRunParameters(runOptions, options);

  if (options.port) {
    runOptions.push(`--port ${options.port}`);
  }
  if (options.docsReadme) {
    runOptions.push(`--docs-readme`);
  }
  if (options.noOpen) {
    runOptions.push(`--no-open`);
  }
  if (options.maxWorkers) {
    runOptions.push(`--max-workers ${options.maxWorkers}`);
  }

  return parseFlags(runOptions);
}

export default async function runExecutor(
  options: StencilBuildOptions,
  context: ExecutorContext
) {
  const taskCommand: TaskCommand = 'build';

  const projGraph = createProjectGraph();
  const { target, dependencies } = calculateProjectDependencies(
    projGraph,
    context.root,
    context.projectName,
    context.targetName,
    context.configurationName
  );

  if (!checkDependentProjectsHaveBeenBuilt(
    context.root,
    context.projectName,
    context.targetName,
    dependencies
  )) {
    return { success: false };
  }

  const flags: ConfigFlags = createStencilCompilerOptions(taskCommand, options);
  const { config, pathCollection } = await initializeStencilConfig(
    taskCommand,
    options,
    context,
    flags,
    dependencies
  );

  const stencilConfig = await prepareConfigAndOutputargetPaths(config, pathCollection);

  updateBuildableProjectPackageJsonDependencies(
    context.root,
    context.projectName,
    context.targetName,
    context.configurationName,
    target,
    dependencies
  );

  try {
    await createStencilProcess(stencilConfig, pathCollection);

    return { success: true };
  } catch (err) {
    logger.error(err.message);

    return { success: false, error: err.message };
  }
}