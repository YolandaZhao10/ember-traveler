import { FLOORS_PER_CHAPTER, TOTAL_FLOORS } from '../../data/chapters';
import { closeOverlay, openOverlay } from '../store';
import { Modal } from './Common';

export function Help() {
  return <Modal title="怎么玩" onClose={closeOverlay}>
    <div className="howto">
      <p>穿过灰烬古城、熔炉深城、星骸天穹与余火终庭，挑战共 {TOTAL_FLOORS} 层。前三章各 {FLOORS_PER_CHAPTER} 层，前 4 层无精英。第四章只有一条线：营火 → 精英 → 商店 → 营火 → 最终首领。前三章首领提供本角色稀有卡和章节遗物三选一。最终首领倒下后自动领取金币，直接通关。</p>
      <p>每回合 <b>3 点能量</b>、抽 <b>5 张牌</b>，先看敌人意图再出牌。<b>余烬</b>（0–10）在战斗内跨回合保留，可积累后消耗换取爆发。</p>
      <p>营火随机分布，允许同层出现多个。首领门前整层均为营火；包含这次整备，每条完整路线共 2–5 个营火。</p>
      <p>桌面端：拖牌指向敌人，松手出牌；也可点击选牌后点击目标。数字键选牌，E 结束回合。手机：点选卡牌后点击敌人。长按或未瞄准时右键卡牌查看详情。</p>
      <p>在营火选择锻造，先挑牌查看升级前后对比，再确认升级。菜单提供图鉴、旅程记录和快速 SL；战后 SL 返回领奖页，不重打敌人。旅程记录可查看角色胜率、通关牌组与用时。顶部显示本局用时，回首页、切后台或结算时暂停，刷新和 SL 保留累计时间。</p>
    </div>
    <button className="btn" onClick={() => openOverlay({ kind: 'menu' })}>返回菜单</button>
  </Modal>;
}
