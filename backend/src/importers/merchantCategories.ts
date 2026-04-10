/**
 * Built-in merchant-to-category keyword mapping.
 * Used as fallback when rule engine doesn't match.
 */

const MERCHANT_KEYWORDS: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['美团', '饿了么', '肯德基', '麦当劳', '星巴克', '瑞幸', '海底捞', '必胜客', '汉堡王', '寿司', '餐饮', '茶', '咖啡', '面包', '烘焙', '蛋糕', '奶茶', '火锅', '烤肉', '外卖', '食品', '梅园', '好利来'], category: '餐饮' },
  { keywords: ['滴滴', '高德', '中铁', '铁路', '航空', '机票', '火车票', '地铁', '公交', '出行', '打车', '加油', '中国石油', '中国石化', '停车', '速停车', '驿停车', '充电', '超充'], category: '交通' },
  { keywords: ['淘宝', '京东', '拼多多', '天猫', '苹果', 'Apple', '亚马逊', '网购', '商城', '奥特莱斯', '百货', '商场', '万象汇', '大融城'], category: '购物' },
  { keywords: ['iCloud', '腾讯云', '阿里云', '华为云', '智谱', 'OpenAI', 'Claude', 'API'], category: '数码' },
  { keywords: ['电影', '影院', '哔哩哔哩', 'B站', '网易云', '优酷', '爱奇艺', '腾讯视频', 'Spotify', '游戏', '娱乐', '演出', '票务', '淘票票'], category: '娱乐' },
  { keywords: ['医院', '药房', '药店', '诊所', '医疗', '金象大药房'], category: '医疗' },
  { keywords: ['移动', '联通', '电信', '话费', '宽带'], category: '通讯' },
  { keywords: ['水费', '电费', '燃气', '物业', '房租', '租金', '管理费'], category: '居住' },
  { keywords: ['学费', '培训', '教育', '课程', '书店', '图书'], category: '教育' },
  { keywords: ['健身', '运动', '体育', '安踏', '耐克', 'Nike', '阿迪达斯', '滔搏'], category: '运动' },
  { keywords: ['保险', '社保', '公积金'], category: '保险' },
  { keywords: ['快递', '顺丰', '圆通', '中通', '韵达', '极兔'], category: '快递' },
  { keywords: ['公园', '景区', '门票', '旅游', '酒店', '凯悦', '希尔顿', '万豪'], category: '旅游' },
];

export function suggestCategoryByMerchant(description: string, merchant?: string): string | null {
  const text = `${description} ${merchant || ''}`.toLowerCase();
  for (const group of MERCHANT_KEYWORDS) {
    for (const keyword of group.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return group.category;
      }
    }
  }
  return null;
}
