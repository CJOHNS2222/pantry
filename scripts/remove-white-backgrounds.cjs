const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const DEFAULT_FOLDERS = ['public/images/items', 'public/images'];
const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.json', '.html', '.css', '.scss', '.md'
]);
const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'build', 'coverage', 'android', 'website/node_modules', 'functions/node_modules'
]);

function parseArgs(argv) {
  const options = {
    folders: [...DEFAULT_FOLDERS],
    threshold: 236,
    variance: 24,
    feather: 28,
    batchSize: 25,
    startAt: 0,
    dryRun: false,
    cleanupTempsOnly: false,
    keepOriginals: true,
    include: null,
    verbose: false,
    updateRefs: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--cleanup-temps-only') {
      options.cleanupTempsOnly = true;
    } else if (arg === '--delete-originals') {
      options.keepOriginals = false;
    } else if (arg === '--no-update-refs') {
      options.updateRefs = false;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--folders') {
      options.folders = String(argv[index + 1] || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
    } else if (arg === '--include') {
      options.include = String(argv[index + 1] || '').trim().toLowerCase();
      index += 1;
    } else if (arg === '--batch-size') {
      options.batchSize = Number(argv[index + 1] || options.batchSize);
      index += 1;
    } else if (arg === '--start-at') {
      options.startAt = Number(argv[index + 1] || options.startAt);
      index += 1;
    } else if (arg === '--threshold') {
      options.threshold = Number(argv[index + 1] || options.threshold);
      index += 1;
    } else if (arg === '--variance') {
      options.variance = Number(argv[index + 1] || options.variance);
      index += 1;
    } else if (arg === '--feather') {
      options.feather = Number(argv[index + 1] || options.feather);
      index += 1;
    }
  }

  return options;
}

function isRasterFile(fileName) {
  return RASTER_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function isTextFile(fileName) {
  return TEXT_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function buildTempPngPath(targetPath) {
  const directory = path.dirname(targetPath);
  const extension = path.extname(targetPath);
  const baseName = path.basename(targetPath, extension);
  return path.join(directory, `${baseName}.tmp-remove-bg${extension || '.png'}`);
}

function shouldIgnoreDir(relativeDir) {
  return relativeDir.split(/[\\/]/).some((segment) => IGNORED_DIRS.has(segment));
}

function walkTextFiles(dirPath, results = []) {
  const relativeDir = path.relative(ROOT, dirPath);
  if (shouldIgnoreDir(relativeDir)) {
    return results;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkTextFiles(fullPath, results);
      continue;
    }

    if (isTextFile(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

function listRasterFiles(folderPath, includeFilter) {
  if (!fs.existsSync(folderPath)) {
    return [];
  }

  return fs.readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isFile() || !isRasterFile(entry.name)) {
        return false;
      }

      const lowerName = entry.name.toLowerCase();
      return !lowerName.includes('.preview.') && !lowerName.startsWith('screenshot_');
    })
    .map((entry) => path.join(folderPath, entry.name))
    .filter((filePath) => {
      if (!includeFilter) {
        return true;
      }

      const normalized = path.basename(filePath).toLowerCase();
      return normalized.includes(includeFilter);
    });
}

function listTempFiles(folderPath, includeFilter) {
  if (!fs.existsSync(folderPath)) {
    return [];
  }

  return fs.readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().includes('.tmp-remove-bg.'))
    .map((entry) => path.join(folderPath, entry.name))
    .filter((filePath) => {
      if (!includeFilter) {
        return true;
      }

      return path.basename(filePath).toLowerCase().includes(includeFilter);
    });
}

function toRgbaIndex(width, x, y) {
  return (y * width + x) * 4;
}

function isEdgeConnectedWhite(data, width, x, y, threshold, variance) {
  const index = toRgbaIndex(width, x, y);
  const alpha = data[index + 3];

  if (alpha <= 8) {
    return true;
  }

  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const minimum = Math.min(red, green, blue);
  const maximum = Math.max(red, green, blue);

  return minimum >= threshold && maximum - minimum <= variance;
}

function isFeatherCandidate(data, width, x, y, threshold, variance, feather) {
  const index = toRgbaIndex(width, x, y);
  const alpha = data[index + 3];
  if (alpha <= 8) {
    return false;
  }

  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const minimum = Math.min(red, green, blue);
  const maximum = Math.max(red, green, blue);

  return minimum >= threshold - feather && maximum - minimum <= variance + 18;
}

async function hasRealTransparency(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 3; index < data.length; index += info.channels) {
    if (data[index] < 250) {
      return true;
    }
  }

  return false;
}

async function removeWhiteBackground(filePath, options) {
  const extension = path.extname(filePath).toLowerCase();
  if ((extension === '.png' || extension === '.webp') && await hasRealTransparency(filePath)) {
    return { status: 'skipped-alpha', source: filePath };
  }

  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const background = new Uint8Array(width * height);
  const queue = [];

  function tryPush(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const flatIndex = y * width + x;
    if (visited[flatIndex]) {
      return;
    }

    visited[flatIndex] = 1;
    if (isEdgeConnectedWhite(data, width, x, y, options.threshold, options.variance)) {
      background[flatIndex] = 1;
      queue.push([x, y]);
    }
  }

  for (let x = 0; x < width; x += 1) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  const expansionPasses = Math.max(1, Math.round(options.feather / 12));
  for (let pass = 0; pass < expansionPasses; pass += 1) {
    const expansion = new Uint8Array(width * height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const flatIndex = y * width + x;
        if (background[flatIndex]) {
          continue;
        }

        let touchesBackground = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }

          if (background[ny * width + nx]) {
            touchesBackground = true;
            break;
          }
        }

        if (touchesBackground && isFeatherCandidate(data, width, x, y, options.threshold, options.variance, options.feather)) {
          expansion[flatIndex] = 1;
        }
      }
    }

    for (let index = 0; index < expansion.length; index += 1) {
      if (expansion[index]) {
        background[index] = 1;
      }
    }
  }

  let changedPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const flatIndex = y * width + x;
      const index = toRgbaIndex(width, x, y);

      if (background[flatIndex]) {
        if (data[index + 3] !== 0) {
          changedPixels += 1;
        }
        data[index] = 255;
        data[index + 1] = 255;
        data[index + 2] = 255;
        data[index + 3] = 0;
      }
    }
  }

  if (changedPixels === 0) {
    return { status: 'unchanged', source: filePath };
  }

  const outputPath = extension === '.png'
    ? filePath
    : path.join(path.dirname(filePath), `${path.basename(filePath, extension)}.png`);

  if (!options.dryRun) {
    const writePath = outputPath === filePath
      ? buildTempPngPath(outputPath)
      : outputPath;

    await sharp(data, {
      raw: {
        width,
        height,
        channels: 4,
      },
    }).png().toFile(writePath);

    if (writePath !== outputPath) {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      fs.renameSync(writePath, outputPath);
    }

    if (!options.keepOriginals && outputPath !== filePath) {
      fs.unlinkSync(filePath);
    }
  }

  return {
    status: 'updated',
    source: filePath,
    output: outputPath,
    changedPixels,
    extensionChanged: outputPath !== filePath,
  };
}

function replaceAll(content, fromValue, toValue) {
  return content.split(fromValue).join(toValue);
}

function updateReferences(changes, options) {
  if (!options.updateRefs) {
    return [];
  }

  const extensionChanges = changes.filter((change) => change.status === 'updated' && change.extensionChanged);
  if (extensionChanges.length === 0) {
    return [];
  }

  const textFiles = walkTextFiles(ROOT);
  const updates = [];

  for (const filePath of textFiles) {
    const relativePath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    if (relativePath.startsWith('public/')) {
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    for (const change of extensionChanges) {
      const oldName = path.basename(change.source);
      const newName = path.basename(change.output);
      const oldRelative = path.relative(ROOT, change.source).replace(/\\/g, '/');
      const newRelative = path.relative(ROOT, change.output).replace(/\\/g, '/');
      const oldPublicPath = `/${oldRelative.replace(/^public\//, '').replace(/^public\//, '')}`;
      const newPublicPath = `/${newRelative.replace(/^public\//, '').replace(/^public\//, '')}`;

      content = replaceAll(content, oldPublicPath, newPublicPath);
      content = replaceAll(content, oldRelative, newRelative);
      content = replaceAll(content, oldName, newName);
    }

    if (content !== originalContent) {
      if (!options.dryRun) {
        fs.writeFileSync(filePath, content, 'utf8');
      }
      updates.push(relativePath);
    }
  }

  return updates;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const folderPaths = Array.from(new Set(options.folders.map((folder) => path.resolve(ROOT, folder))));
  const allFiles = Array.from(new Set(folderPaths.flatMap((folderPath) => listRasterFiles(folderPath, options.include))));
  const files = allFiles.slice(options.startAt, options.startAt + Math.max(1, options.batchSize));
  const staleTemps = Array.from(new Set(folderPaths.flatMap((folderPath) => listTempFiles(folderPath, options.include))));

  if (!options.dryRun && staleTemps.length > 0) {
    for (const tempFilePath of staleTemps) {
      fs.unlinkSync(tempFilePath);
    }
  }

  if (options.cleanupTempsOnly) {
    console.log('Bulk White Background Removal');
    console.log(`  Folders:         ${folderPaths.map((folderPath) => path.relative(ROOT, folderPath).replace(/\\/g, '/')).join(', ')}`);
    console.log(`  Temp files:      ${staleTemps.length}`);
    console.log(`  Mode:            ${options.dryRun ? 'dry-run' : 'cleanup-only'}`);
    console.log('');
    console.log('Done!');
    return;
  }

  if (files.length === 0) {
    console.log('No matching raster images found.');
    return;
  }

  console.log('Bulk White Background Removal');
  console.log(`  Folders:         ${folderPaths.map((folderPath) => path.relative(ROOT, folderPath).replace(/\\/g, '/')).join(', ')}`);
  console.log(`  Files:           ${files.length} of ${allFiles.length}`);
  console.log(`  Start at:        ${options.startAt}`);
  console.log(`  Batch size:      ${options.batchSize}`);
  console.log(`  Threshold:       ${options.threshold}`);
  console.log(`  Variance:        ${options.variance}`);
  console.log(`  Feather:         ${options.feather}`);
  console.log(`  Mode:            ${options.dryRun ? 'dry-run' : 'write'}`);
  console.log(`  Originals:       ${options.keepOriginals ? 'kept' : 'deleted on extension change'}`);
  console.log(`  Stale temps:     ${options.dryRun ? 0 : staleTemps.length}`);

  const results = [];
  for (const filePath of files) {
    const relative = path.relative(ROOT, filePath).replace(/\\/g, '/');
    try {
      const result = await removeWhiteBackground(filePath, options);
      results.push(result);
      const suffix = result.output
        ? `${path.basename(result.output)}${result.extensionChanged ? ' (new png)' : ''}`
        : result.status;
      console.log(`  ${result.status.padEnd(13)} ${relative} -> ${suffix}`);
    } catch (error) {
      results.push({ status: 'failed', source: filePath, error: error.message });
      console.log(`  failed        ${relative} -> ${error.message}`);
    }
  }

  const updatedRefs = updateReferences(results, options);
  const updated = results.filter((result) => result.status === 'updated').length;
  const unchanged = results.filter((result) => result.status === 'unchanged').length;
  const skippedAlpha = results.filter((result) => result.status === 'skipped-alpha').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  const extensionChanges = results.filter((result) => result.status === 'updated' && result.extensionChanged).length;

  console.log('');
  console.log('Done!');
  console.log(`  Updated:         ${updated}`);
  console.log(`  Unchanged:       ${unchanged}`);
  console.log(`  Skipped alpha:   ${skippedAlpha}`);
  console.log(`  Failed:          ${failed}`);
  console.log(`  New PNG files:   ${extensionChanges}`);
  console.log(`  Ref files edit:  ${updatedRefs.length}`);

  if (options.verbose && updatedRefs.length > 0) {
    for (const filePath of updatedRefs) {
      console.log(`    - ${filePath}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});