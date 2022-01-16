'use-strict';

const { spawn } = require('child_process');
const readline = require('readline');

const { LoggerService } = require('../../../services/logger/logger.service');
const { ConfigService } = require('../../../services/config/config.service');

const { log } = LoggerService;

class MediaService {
  #camera;

  constructor(camera) {
    //log.debug('Initializing camera probe', camera.name);

    this.#camera = camera;
    this.cameraName = camera.name;

    this.codecs = {
      probe: false,
      timedout: false,
      audio: [],
      video: [],
    };
  }

  async reconfigure(camera) {
    const oldVideoConfigSubSource = this.#camera.videoConfig.subSource;
    const newVideoConfigSubSource = camera.videoConfig.subSource;

    this.#camera = camera;
    this.cameraName = camera.name;

    if (oldVideoConfigSubSource !== newVideoConfigSubSource) {
      log.info('Probe: Video source changed! Probe stream...', this.cameraName);
      await this.probe();
    }
  }

  async probe() {
    // eslint-disable-next-line no-unused-vars
    return new Promise((resolve, reject) => {
      log.debug(
        `Probe stream: ${ConfigService.ui.options.videoProcessor} ${this.#camera.videoConfig.subSource}`,
        this.cameraName
      );

      const arguments_ = [
        '-hide_banner',
        '-loglevel',
        'info',
        '-analyzeduration',
        '0',
        '-probesize',
        '5000',
        ...this.#camera.videoConfig.source.split(/\s+/),
      ];

      let cp = spawn(ConfigService.ui.options.videoProcessor, arguments_, {
        env: process.env,
      });

      const stderr = readline.createInterface({
        input: cp.stderr,
        terminal: false,
      });

      stderr.on('line', (line) => {
        const audioLine = line.includes('Audio: ') ? line.split('Audio: ')[1] : false;

        if (audioLine) {
          this.codecs.audio = audioLine.split(', ');
        }

        const videoLine = line.includes('Video: ') ? line.split('Video: ')[1] : false;

        if (videoLine) {
          this.codecs.video = videoLine.split(', ');
        }
      });

      cp.on('exit', () => {
        this.codecs.probe = true;
        log.debug(this.codecs, this.cameraName);

        cp = null;

        resolve(this.codecs);
      });

      setTimeout(() => {
        if (cp) {
          log.warn('Can not determine stream codecs, probe timed out', this.cameraName, 'ffmpeg');

          this.codecs.timedout = true;
          cp.kill('SIGKILL');
        }
      }, 5000);
    });
  }
}

exports.MediaService = MediaService;
