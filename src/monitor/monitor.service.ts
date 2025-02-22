import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Cron } from '@nestjs/schedule';
import { MailService } from '../mail/mail.service';

@Injectable()
export class MonitorService {
  private previousBlockHeight = 0;
  private previousVotingPower = 0;

  constructor(
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  private async fetchData(url: string) {
    try {
      const response = await axios.get(url);
      return response.data.result;
    } catch (error) {
      console.error(`❌ Error fetching data from ${url}:`, error.message);
      return null;
    }
  }

  private async getSignatures(blockHeight: number) {
    const externalRpcServer = this.configService.get<string>(
      'EXTERNAL_RPC_SERVER',
    );
    try {
      const response = await axios.get(
        `${externalRpcServer}/block?height=${blockHeight}`,
      );
      return response.data.result.block.last_commit.signatures.map(
        (sig) => sig.validator_address,
      );
    } catch (error) {
      console.error(
        `❌ Error fetching signatures for block ${blockHeight}:`,
        error.message,
      );
      return [];
    }
  }

  @Cron('*/1 * * * *') // Chạy mỗi 15 phút
  async checkNodeStatus() {
    console.log('🔍 Checking Namada node status...');

    const rpcServer = this.configService.get<string>('RPC_SERVER');
    const externalRpcServer = this.configService.get<string>(
      'EXTERNAL_RPC_SERVER',
    );
    const blockGapAlarm = this.configService.get<number>('BLOCK_GAP_ALARM');
    const maxMissedBlocks = this.configService.get<number>('MAX_MISSED_BLOCKS');

    // Lấy dữ liệu từ node của bạn
    const nodeData = await this.fetchData(`${rpcServer}/status`);
    if (!nodeData) return;

    const blockHeight = parseInt(nodeData.sync_info.latest_block_height);
    const validatorAddress = nodeData.validator_info.address;
    const votingPower = parseInt(nodeData.validator_info.voting_power);

    // Kiểm tra Block Height
    const externalData = await this.fetchData(`${externalRpcServer}/status`);
    if (!externalData) return;

    const expectedBlockHeight = parseInt(
      externalData.sync_info.latest_block_height,
    );

    console.log(
      `🟢 Node Block Height: ${blockHeight}, Expected: ${expectedBlockHeight}`,
    );

    if (expectedBlockHeight - blockHeight >= blockGapAlarm) {
      await this.mailService.sendEmail(
        '⚠️ Cảnh báo: Node Namada bị chậm',
        `Node của bạn đang chậm ${expectedBlockHeight - blockHeight} block.`,
      );
    }

    // Kiểm tra Voting Power
    if (
      this.previousVotingPower !== 0 &&
      votingPower !== this.previousVotingPower
    ) {
      await this.mailService.sendEmail(
        '⚠️ Cảnh báo: Voting Power Thay Đổi',
        `Voting Power đã thay đổi từ ${this.previousVotingPower} → ${votingPower}`,
      );
    }

    this.previousVotingPower = votingPower;
    this.previousBlockHeight = blockHeight;

    // Kiểm tra validator có bỏ lỡ block không
    await this.checkValidatorActivity(
      validatorAddress,
      blockHeight,
      maxMissedBlocks,
    );

    console.log('✅ Node status checked.');
  }

  private async checkValidatorActivity(
    validatorAddress: string,
    currentBlockHeight: number,
    maxMissedBlocks: number,
  ) {
    let missedBlocks = 0;
    let maxConsecutiveMissed = 0;
    let currentConsecutiveMissed = 0;

    console.log('🔍 Checking validator missed blocks...');

    for (let i = currentBlockHeight - 100; i < currentBlockHeight; i++) {
      const signatures = await this.getSignatures(i);
      if (!signatures.includes(validatorAddress)) {
        missedBlocks++;
        currentConsecutiveMissed++;
        maxConsecutiveMissed = Math.max(
          maxConsecutiveMissed,
          currentConsecutiveMissed,
        );
      } else {
        currentConsecutiveMissed = 0;
      }
    }

    if (missedBlocks > maxMissedBlocks) {
      await this.mailService.sendEmail(
        '⚠️ Cảnh báo: Validator bỏ lỡ nhiều block',
        `Validator ${validatorAddress} đã bỏ lỡ ${missedBlocks} / 100 block gần nhất. Bỏ lỡ liên tiếp: ${maxConsecutiveMissed}`,
      );
    }

    console.log(
      `✅ Validator ${validatorAddress} checked: Missed ${missedBlocks} blocks.`,
    );
  }
}
