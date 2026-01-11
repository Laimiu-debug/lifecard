/**
 * 标签选择器组件
 * 支持多选和数量限制
 * Requirements: 3.6
 */

Component({
  options: {
    styleIsolation: 'apply-shared',
    multipleSlots: true,
  },

  properties: {
    /** 可选标签列表 */
    tags: {
      type: Array,
      value: [] as string[],
    },
    /** 已选中的标签 */
    selected: {
      type: Array,
      value: [] as string[],
    },
    /** 最大可选数量 */
    maxCount: {
      type: Number,
      value: 10,
    },
    /** 是否允许自定义标签 */
    allowCustom: {
      type: Boolean,
      value: false,
    },
    /** 自定义标签最大长度 */
    customMaxLength: {
      type: Number,
      value: 20,
    },
    /** 标签类型：emotion | interest */
    tagType: {
      type: String,
      value: 'interest',
    },
    /** 是否禁用 */
    disabled: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    // 内部选中状态
    selectedTags: [] as string[],
    // 自定义标签输入
    customInput: '',
    // 是否显示自定义输入框
    showCustomInput: false,
  },

  observers: {
    'selected': function(selected: string[]) {
      if (Array.isArray(selected)) {
        this.setData({ selectedTags: [...selected] });
      }
    },
  },

  lifetimes: {
    attached() {
      // 初始化选中状态
      if (Array.isArray(this.data.selected)) {
        this.setData({ selectedTags: [...this.data.selected] });
      }
    },
  },

  methods: {
    /**
     * 切换标签选中状态
     */
    onToggleTag(e: WechatMiniprogram.TouchEvent) {
      if (this.data.disabled) return;

      const { tag } = e.currentTarget.dataset;
      if (!tag) return;

      const { selectedTags, maxCount } = this.data;
      const index = selectedTags.indexOf(tag);

      let newSelected: string[];
      if (index > -1) {
        // 取消选中
        newSelected = selectedTags.filter((t: string) => t !== tag);
      } else {
        // 选中
        if (selectedTags.length >= maxCount) {
          wx.showToast({
            title: `最多选择${maxCount}个标签`,
            icon: 'none',
          });
          return;
        }
        newSelected = [...selectedTags, tag];
      }

      this.setData({ selectedTags: newSelected });
      this.triggerEvent('change', { selected: newSelected });
    },

    /**
     * 显示自定义输入框
     */
    onShowCustomInput() {
      if (this.data.disabled) return;
      
      const { selectedTags, maxCount } = this.data;
      if (selectedTags.length >= maxCount) {
        wx.showToast({
          title: `最多选择${maxCount}个标签`,
          icon: 'none',
        });
        return;
      }

      this.setData({ showCustomInput: true });
    },

    /**
     * 隐藏自定义输入框
     */
    onHideCustomInput() {
      this.setData({ 
        showCustomInput: false,
        customInput: '',
      });
    },

    /**
     * 自定义标签输入
     */
    onCustomInput(e: WechatMiniprogram.Input) {
      this.setData({ customInput: e.detail.value });
    },

    /**
     * 添加自定义标签
     */
    onAddCustomTag() {
      const { customInput, selectedTags, maxCount, customMaxLength } = this.data;
      const trimmed = customInput.trim();

      if (!trimmed) {
        wx.showToast({ title: '请输入标签内容', icon: 'none' });
        return;
      }

      if (trimmed.length > customMaxLength) {
        wx.showToast({ title: `标签不能超过${customMaxLength}个字`, icon: 'none' });
        return;
      }

      if (selectedTags.includes(trimmed)) {
        wx.showToast({ title: '该标签已存在', icon: 'none' });
        return;
      }

      if (selectedTags.length >= maxCount) {
        wx.showToast({ title: `最多选择${maxCount}个标签`, icon: 'none' });
        return;
      }

      const newSelected = [...selectedTags, trimmed];
      this.setData({ 
        selectedTags: newSelected,
        customInput: '',
        showCustomInput: false,
      });
      this.triggerEvent('change', { selected: newSelected });
      this.triggerEvent('customadd', { tag: trimmed });
    },

    /**
     * 移除已选标签
     */
    onRemoveTag(e: WechatMiniprogram.TouchEvent) {
      if (this.data.disabled) return;

      const { tag } = e.currentTarget.dataset;
      if (!tag) return;

      const newSelected = this.data.selectedTags.filter((t: string) => t !== tag);
      this.setData({ selectedTags: newSelected });
      this.triggerEvent('change', { selected: newSelected });
    },

    /**
     * 检查标签是否选中
     */
    isSelected(tag: string): boolean {
      return this.data.selectedTags.includes(tag);
    },
  },
});
